const User = require('../models/user');
const Stock = require('../models/stock');
const Product = require('../models/product');
const Order = require('../models/order');
const transporter = require('../mailer');


const orderRouter = (router) => {
    router.get('/orders/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        

        const order = await Order.findById(orderId)
        .populate('customer', 'firstName lastName email phone')
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
        const { adminId, status } = req.query;

       


        const admin = await User.findById(adminId);
        if (!admin || admin.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized. Admin access required' });
        }


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
        .populate('customer', 'firstName lastName email phone')
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
        .populate('customer', 'firstName lastName email')
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
            const { status, adminId } = req.body;
    
    
            const admin = await User.findById(adminId);
            if (!admin || admin.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized. Admin access required' });
            }
    
    
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
}

module.exports=orderRouter ;