const User = require('../models/user');
const Stock = require('../models/stock');
const Product = require('../models/product');
const Order = require('../models/order');
const transporter = require('../mailer');
const Chat=require("../models/chat")


const orderRouter = (router) => {
    router.get('/deliverer/available-orders', async (req, res) => {
        try {
            const { delivererId } = req.query;


            // Validate deliverer exists and has correct role
            const deliverer = await User.findById(delivererId);
            if (!deliverer || deliverer.role !== 'delivery') {
            return res.status(403).json({ 
                error: 'Unauthorized. Deliverer access required' 
            });
            }

            // Get orders that are ready and not assigned to any deliverer
            const availableOrders = await Order.find({
            status: 'ready',
            deliverer: { $exists: false } // Not assigned to any deliverer yet
            })
            .populate('customer', 'firstName lastName number')
            .populate('items.product')
            .sort({ createdAt: 1 }); // Oldest first

            res.json({
            message: 'Available orders fetched successfully',
            count: availableOrders.length,
            orders: availableOrders
            });

        } catch (error) {
            console.error('Error fetching available orders:', error);
            res.status(500).json({ 
            error: 'Failed to fetch available orders', 
            details: error.message 
            });
        }
    });
    router.post('/deliverer/mark-delivered/:orderId', async (req, res) => {
        try {
            const { orderId } = req.params;
            const { delivererId } = req.body;

            // Find order assigned to this deliverer
            const order = await Order.findOne({
            _id: orderId,
            deliverer: delivererId,
            status: 'out_for_delivery'
            });

            if (!order) {
            return res.status(404).json({ 
                error: 'Order not found or not assigned to you' 
            });
            }

            // Mark as delivered
            order.status = 'delivered';
            order.actualDeliveryTime = new Date();
            await order.save();

            // Emit socket event
            const io = req.app.get('io');
            io.emit('order:delivered', {
            orderId: order._id,
            orderNumber: order.orderNumber,
            delivererId: delivererId,
            deliveredAt: order.actualDeliveryTime
            });

            res.json({
            message: 'Order marked as delivered',
            order: order
            });

        } catch (error) {
            console.error('Error marking order as delivered:', error);
            res.status(500).json({ 
            error: 'Failed to mark order as delivered', 
            details: error.message 
            });
        }
    });

    router.get('/deliverer/my-orders/:delivererId', async (req, res) => {
        try {
            const { delivererId } = req.params;

            // Get orders assigned to this deliverer
            const myOrders = await Order.find({
            deliverer: delivererId,
            status: 'out_for_delivery'
            })
            .populate('customer', 'firstName lastName number')
            .populate('items.product')
            .sort({ createdAt: -1 });

            res.json({
            message: 'Your orders fetched successfully',
            count: myOrders.length,
            orders: myOrders
            });

        } catch (error) {
            console.error('Error fetching deliverer orders:', error);
            res.status(500).json({ 
            error: 'Failed to fetch your orders', 
            details: error.message 
            });
        }
    });


    router.post('/deliverer/take-order/:orderId', async (req, res) => {
        try {
            const { orderId } = req.params;
            const { delivererId } = req.body;

            // Validate deliverer
            const deliverer = await User.findById(delivererId);
            if (!deliverer || deliverer.role !== 'delivery') {
            return res.status(403).json({ error: 'Unauthorized. Deliverer access required' });
            }

            // Find order and check if it's available
            const order = await Order.findOne({
            _id: orderId,
            status: 'ready',
            deliverer: { $exists: false }
            }).populate('customer', 'firstName lastName number _id');

            if (!order) {
            return res.status(404).json({ 
                error: 'Order not available. It may have been taken by another deliverer.' 
            });
            }

            //chat
            const chat = await Chat.create({ id:`${Date.now()}_${Math.random()}`, client_id:order.customer._id, delivery_id:delivererId, messages: [] });

            // Assign order to deliverer    
            order.deliverer = delivererId;
            order.chatId=chat.id ;
            order.status = 'out_for_delivery';
            await order.save();

            // Emit socket event to notify all deliverers
            const io = req.app.get('io');
            io.emit('order:taken', {
            orderId: order._id,
            orderNumber: order.orderNumber,
            delivererId: delivererId,
            delivererName: `${deliverer.firstName} ${deliverer.lastName}`
            });

            res.json({
            message: 'Order taken successfully',
            order: order
            });

        } catch (error) {
            console.error('Error taking order:', error);
            res.status(500).json({ 
            error: 'Failed to take order', 
            details: error.message 
            });
        }
    });

    router.post('/deliverer/release-order/:orderId', async (req, res) => {
        try {
            const { orderId } = req.params;
            const { delivererId } = req.body;

            // Find order assigned to this deliverer
            const order = await Order.findOne({
            _id: orderId,
            deliverer: delivererId,
            status: 'out_for_delivery'
            });

            if (!order) {
            return res.status(404).json({ 
                error: 'Order not found or not assigned to you' 
            });
            }

            // Release order
            order.deliverer = undefined;
            order.status = 'ready';
            order.chatId="";
            await order.save();

            // Emit socket event to notify all deliverers
            const io = req.app.get('io');
            io.emit('order:released', {
            orderId: order._id,
            orderNumber: order.orderNumber,
            delivererId: delivererId
            });

            res.json({
            message: 'Order released successfully',
            order: order
            });

        } catch (error) {
            console.error('Error releasing order:', error);
            res.status(500).json({ 
            error: 'Failed to release order', 
            details: error.message 
            });
        }
        });




    router.get('/orders/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        

        const order = await Order.findById(orderId)
        .populate('customer', 'firstName lastName email number')
        .populate('items.product');

        if (!order) {
        return res.status(404).json({ error: 'Order not found' });
        }

        res.json({
        message: 'Order fetched successfully',
        order
        });

    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Failed to fetch order', details: error.message });
    }
    });




    router.get('/orders', async (req, res) => {
    try {
        const { status } = req.query;

       


        const query = {};
        

        if (status) {
        const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
            error: 'Invalid status',
            validStatuses 
            });
        }
        query.status = status;
        }


        const orders = await Order.find(query)
        .populate('customer', 'firstName lastName email number')
        .populate('items.product')
        .sort({ createdAt: -1 });

        res.json({
        message: 'Orders fetched successfully',
        count: orders.length,
        filter: status ? { status } : 'all',
        orders
        });

    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
    }
    });


    router.get('/orders/customer/:customerId', async (req, res) => {
    try {
        const { customerId } = req.params;

       


        const customer = await User.findById(customerId);
        if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
        }


        const orders = await Order.find({ customer: customerId })
        .populate('customer', 'firstName lastName email number')
        .populate('items.product')
        .sort({ createdAt: -1 });

        res.json({
        message: 'Orders fetched successfully',
        count: orders.length,
        orders
        });

    } catch (error) {
        console.error('Error fetching customer orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
    }
    });
    router.post('/orders', async (req, res) => {
        try {
            const { customerId, items, deliveryAddress, customerNotes } = req.body;
    
    
            const customer = await User.findById(customerId);
            if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
            }
    
    
            const productIds = items.map(item => item.productId);
            const products = await Product.find({ _id: { $in: productIds } });
    
            if (products.length !== items.length) {
            return res.status(400).json({ error: 'One or more products not found' });
            }
    
    
            const unavailableProducts = products.filter(p => !p.isAvailable);
            if (unavailableProducts.length > 0) {
            return res.status(400).json({ 
                error: 'Some products are not available',
                unavailableProducts: unavailableProducts.map(p => p.name)
            });
            }
    
    
            const orderItems = items.map(item => ({
            product: item.productId,
            quantity: item.quantity,
            specialInstructions: item.specialInstructions || ''
            }));
    
            const newOrder = new Order({
            customer: customerId,
            items: orderItems,
            deliveryAddress,
            customerNotes: customerNotes || '',
            status: 'pending'
            });
    
            await newOrder.save();
    
    
            await newOrder.populate('items.product customer');
    
            res.status(201).json({
            message: 'Order placed successfully',
            order: newOrder
            });
    
        } catch (error) {
            console.error('Error placing order:', error);
            res.status(500).json({ error: 'Failed to place order', details: error.message });
        }
    });
    
    
    
    
    router.patch('/orders/:orderId/status', async (req, res) => {
        try {
            const { orderId } = req.params;
            const { status } = req.body;
    
    
            const admin = await User.findOne({role:'admin'});
    
    
            const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];
            if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status', validStatuses });
            }
    
            const order = await Order.findById(orderId).populate('items.product');
            if (!order) {
            return res.status(404).json({ error: 'Order not found' });
            }
    
            const previousStatus = order.status;
            order.status = status;
            await order.save();
    
    
            if (status === 'ready' && previousStatus !== 'ready') {
            await processStockReduction(order, admin);
            }

            if(status=='ready'){
                const io = req.app.get('io');
                io.emit('order:released', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                delivererId: "null"
                });
            }
    
            res.json({
            message: 'Order status updated successfully',
            order: {
                orderNumber: order.orderNumber,
                previousStatus,
                newStatus: status
            }
            });
    
        } catch (error) {
            console.error('Error updating order status:', error);
            res.status(500).json({ error: 'Failed to update order status', details: error.message });
        }
    });
    
    
    
    
    async function processStockReduction(order, admin) {
        try {
            const lowStockAlerts = [];
    
    
            for (const item of order.items) {
            const product = item.product;
    
    
            for (const ingredient of product.ingredients) {
                const stock = await Stock.findById(ingredient.stock);
                
                if (!stock) {
                console.warn(`Stock not found for ingredient: ${ingredient.stock}`);
                continue;
                }
    
    
                const quantityNeeded = ingredient.quantity * item.quantity;
    
    
                stock.quantity -= quantityNeeded;
    
    
                if (stock.quantity <= stock.minThreshold) {
                lowStockAlerts.push({
                    stockName: stock.name,
                    currentQuantity: stock.quantity,
                    minThreshold: stock.minThreshold,
                    unit: stock.unit
                });
                }
    
                await stock.save();
            }
    
    
            product.orderCount += item.quantity;
            await product.save();
            }
    
    
            if (lowStockAlerts.length > 0) {
            await sendLowStockAlert(lowStockAlerts, admin.email);
            }
    
        } catch (error) {
            console.error('Error processing stock reduction:', error);
            throw error;
        }
    }
    
    
    async function sendLowStockAlert(lowStockAlerts, adminEmail) {
        try {
            const stockList = lowStockAlerts.map(stock => 
            `- ${stock.stockName}: ${stock.currentQuantity} ${stock.unit} (Min: ${stock.minThreshold} ${stock.unit})`
            ).join('\n');
    
            const mailOptions = {
            from: process.env.emailAdress,
            to: adminEmail,
            subject: '⚠️ Low Stock Alert - Action Required',
            text: `The following ingredients have fallen below minimum threshold:\n\n${stockList}\n\nPlease restock as soon as possible.`,
            html: `
                <h2>⚠️ Low Stock Alert</h2>
                <p>The following ingredients have fallen below minimum threshold:</p>
                <ul>
                ${lowStockAlerts.map(stock => 
                    `<li><strong>${stock.stockName}</strong>: ${stock.currentQuantity} ${stock.unit} (Min: ${stock.minThreshold} ${stock.unit})</li>`
                ).join('')}
                </ul>
                <p>Please restock as soon as possible.</p>
            `
            };
    
            await transporter.sendMail(mailOptions);
            console.log('Low stock alert email sent successfully');
        } catch (error) {
            console.error('Error sending low stock alert email:', error);
        }
    }








    router.get('/orders/recieved/:customerId', async (req, res) => {
        try {
            const { customerId } = req.params;

            const customer = await User.findById(customerId);
            if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
            }


            const orders = await Order.find({ customer: customerId , status:"recieved" })
            .populate('customer', 'firstName lastName email number')
            .populate('items.product')
            .sort({ createdAt: -1 });

            res.json({
            message: 'Orders fetched successfully',
            orders
            });

        } catch (error) {
            console.error('Error fetching customer orders:', error);
            res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
        }
    });


    router.get('/orders/non-recieved/:customerId', async (req, res) => {
        try {
            const { customerId } = req.params;

            const customer = await User.findById(customerId);
            if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
            }


            const orders = await Order.find({ customer: customerId , status:{ $in: ['confirmed','ready', 'out_for_delivery', 'delivered'] } })
            .populate('customer', 'firstName lastName email number')
            .populate('items.product')
            .sort({ createdAt: -1 });

            res.json({
            message: 'Orders fetched successfully',
            count: orders.length,
            orders
            });

        } catch (error) {
            console.error('Error fetching customer orders:', error);
            res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
        }
    });



    router.get('/orders/most-ordered/:customerId', async (req, res) => {
            try {
                const { customerId } = req.params;
        
        
                const orders = await Order.find({customer: customerId , status: "recieved"}).populate('items.product');
        
        
                const productOrderCount = {};
                let totalProductQuantity = 0;
        
                orders.forEach(order => {
                order.items.forEach(item => {
                    if (item.product) {
                    const productId = item.product._id.toString();
                    
                    if (!productOrderCount[productId]) {
                        productOrderCount[productId] = {
                        product: item.product,
                        orderCount: 0,
                        totalQuantity: 0
                        };
                    }
                    
                    productOrderCount[productId].orderCount += 1;
                    productOrderCount[productId].totalQuantity += item.quantity;
                    totalProductQuantity += item.quantity;
                    }
                });
            });
        
        
                const productPercentages = Object.values(productOrderCount).map(product => ({
                product: product.product,
                orderCount: product.orderCount,
                totalQuantity: product.totalQuantity,
                percentage: totalProductQuantity > 0 
                    ? Math.round((product.totalQuantity / totalProductQuantity) * 10000) / 100 
                    : 0
                })).sort((a, b) => b.percentage - a.percentage);
        
                res.json({
                    totalOrders: orders.length,
                    totalProductQuantity,
                    productPercentages
                });
        
            } catch (error) {
                console.error('Error calculating product order percentage:', error);
                res.status(500).json({ error: 'Failed to calculate product order percentage', details: error.message });
            }
    });
}

module.exports=orderRouter ;