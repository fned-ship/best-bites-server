const User = require('../models/user');
const Stock = require('../models/stock');
const Product = require('../models/product');
const Order = require('../models/order');
const transporter = require('../mailer');
const fs = require('fs');
const multer = require('multer');
const path = require('path');


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/products');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const fileName = `${Date.now()}_${Math.random()}_${file.originalname}`;
    cb(null, fileName);
  },
});

const upload = multer({ storage });

const main = (router) => {

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






    router.post('/products', upload.single('image'), async (req, res) => {
        try {
            const { adminId, ...productData } = req.body;


            const admin = await User.findById(adminId);
            if (!admin || admin.role !== 'admin') {

                if (req.file) {
                    fs.unlinkSync(req.file.path);
                }
                return res.status(403).json({ error: 'Unauthorized. Admin access required' });
            }


            if (req.file) {
                productData.image = `/products/${req.file.filename}`;
            } else {

                productData.image = '/products/default-product.png';
            }


            if (typeof productData.ingredients === 'string') {
                try {
                    productData.ingredients = JSON.parse(productData.ingredients);
                } catch (error) {

                    if (req.file) {
                        fs.unlinkSync(req.file.path);
                    }
                    return res.status(400).json({ 
                        error: 'Invalid ingredients format. Must be valid JSON array' 
                    });
                }
            }

            const newProduct = new Product(productData);
            await newProduct.save();

            res.status(201).json({
                message: 'Product added successfully',
                product: newProduct
            });

        } catch (error) {

            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            
            console.error('Error adding product:', error);
            res.status(500).json({ error: 'Failed to add product', details: error.message });
        }
    });


    router.put('/products/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const { adminId, ...updateData } = req.body;


        const admin = await User.findById(adminId);
        if (!admin || admin.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized. Admin access required' });
        }

        const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        updateData,
        { new: true, runValidators: true }
        );

        if (!updatedProduct) {
        return res.status(404).json({ error: 'Product not found' });
        }

        res.json({
        message: 'Product updated successfully',
        product: updatedProduct
        });

    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product', details: error.message });
    }
    });


    router.delete('/products/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const { adminId } = req.body;


        const admin = await User.findById(adminId);
        if (!admin || admin.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized. Admin access required' });
        }

        const deletedProduct = await Product.findByIdAndDelete(productId);

        if (!deletedProduct) {
        return res.status(404).json({ error: 'Product not found' });
        }

        res.json({
        message: 'Product deleted successfully',
        product: deletedProduct
        });

    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Failed to delete product', details: error.message });
    }
    });






    router.post('/stocks', async (req, res) => {
    try {
        const { adminId, ...stockData } = req.body;


        const admin = await User.findById(adminId);
        if (!admin || admin.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized. Admin access required' });
        }

        const newStock = new Stock(stockData);
        await newStock.save();

        res.status(201).json({
        message: 'Stock added successfully',
        stock: newStock
        });

    } catch (error) {
        console.error('Error adding stock:', error);
        res.status(500).json({ error: 'Failed to add stock', details: error.message });
    }
    });


    router.put('/stocks/:stockId', async (req, res) => {
    try {
        const { stockId } = req.params;
        const { adminId, ...updateData } = req.body;


        const admin = await User.findById(adminId);
        if (!admin || admin.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized. Admin access required' });
        }

        const updatedStock = await Stock.findByIdAndUpdate(
        stockId,
        updateData,
        { new: true, runValidators: true }
        );

        if (!updatedStock) {
        return res.status(404).json({ error: 'Stock not found' });
        }

        res.json({
        message: 'Stock updated successfully',
        stock: updatedStock
        });

    } catch (error) {
        console.error('Error updating stock:', error);
        res.status(500).json({ error: 'Failed to update stock', details: error.message });
    }
    });


    router.delete('/stocks/:stockId', async (req, res) => {
    try {
        const { stockId } = req.params;
        const { adminId } = req.body;


        const admin = await User.findById(adminId);
        if (!admin || admin.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized. Admin access required' });
        }


        const productsUsingStock = await Product.find({ 'ingredients.stock': stockId });
        if (productsUsingStock.length > 0) {
        return res.status(400).json({ 
            error: 'Cannot delete stock. It is used in products',
            products: productsUsingStock.map(p => p.name)
        });
        }

        const deletedStock = await Stock.findByIdAndDelete(stockId);

        if (!deletedStock) {
        return res.status(404).json({ error: 'Stock not found' });
        }

        res.json({
        message: 'Stock deleted successfully',
        stock: deletedStock
        });

    } catch (error) {
        console.error('Error deleting stock:', error);
        res.status(500).json({ error: 'Failed to delete stock', details: error.message });
    }
    });




    router.post('/products/:productId/rating', async (req, res) => {
    try {
        const { productId } = req.params;
        const { customerId, rating } = req.body;


        const customer = await User.findById(customerId);
        if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
        }


        if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        const product = await Product.findById(productId);
        if (!product) {
        return res.status(404).json({ error: 'Product not found' });
        }


        const currentTotal = product.rating.average * product.rating.count;
        const newCount = product.rating.count + 1;
        const newAverage = (currentTotal + rating) / newCount;

        product.rating.average = Math.round(newAverage * 10) / 10;
        product.rating.count = newCount;

        await product.save();

        res.json({
        message: 'Rating added successfully',
        product: {
            name: product.name,
            rating: product.rating
        }
        });

    } catch (error) {
        console.error('Error adding rating:', error);
        res.status(500).json({ error: 'Failed to add rating', details: error.message });
    }
    });




    router.get('/products', async (req, res) => {
    try {
        const products = await Product.find()
        .populate('ingredients.stock')
        .sort({ orderCount: -1 });

        res.json({
        count: products.length,
        products
        });

    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products', details: error.message });
    }
    });




    router.get('/stocks', async (req, res) => {
    try {
        const stocks = await Stock.find().sort({ name: 1 });


        const stocksWithStatus = stocks.map(stock => ({
        ...stock.toObject(),
        status: stock.status
        }));

        res.json({
        count: stocksWithStatus.length,
        stocks: stocksWithStatus
        });

    } catch (error) {
        console.error('Error fetching stocks:', error);
        res.status(500).json({ error: 'Failed to fetch stocks', details: error.message });
    }
    });




    router.post('/products/top-ordered', async (req, res) => {
    try {
        const { customerId } = req.body;


        const customer = await User.findById(customerId);
        if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
        }


        const orders = await Order.find({ 
        customer: customerId,
        status: { $in: ['delivered', 'ready', 'out_for_delivery'] }
        }).populate('items.product');


        const productCounts = {};
        
        orders.forEach(order => {
        order.items.forEach(item => {
            if (item.product) {
            const productId = item.product._id.toString();
            if (!productCounts[productId]) {
                productCounts[productId] = {
                product: item.product,
                totalOrdered: 0
                };
            }
            productCounts[productId].totalOrdered += item.quantity;
            }
        });
        });


        const topProducts = Object.values(productCounts)
        .sort((a, b) => b.totalOrdered - a.totalOrdered)
        .slice(0, 10)
        .map(item => ({
            product: item.product,
            timesOrdered: item.totalOrdered
        }));

        res.json({
        customerId,
        topProducts
        });

    } catch (error) {
        console.error('Error fetching top ordered products:', error);
        res.status(500).json({ error: 'Failed to fetch top ordered products', details: error.message });
    }
    });




    router.get('/analytics/daily-income', async (req, res) => {
    try {
        const { adminId, startDate, endDate } = req.query;


        const admin = await User.findById(adminId);
        if (!admin || admin.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized. Admin access required' });
        }


        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);


        const dailyIncome = await Order.aggregate([
        {
            $match: {
            status: 'delivered',
            createdAt: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
            _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
            },
            totalIncome: { $sum: { $multiply: [{ $size: '$items' }, 1] } },
            orderCount: { $sum: 1 }
            }
        },
        {
            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
        }
        ]);



        const detailedIncome = await Promise.all(
        dailyIncome.map(async (day) => {
            const dayStart = new Date(day._id.year, day._id.month - 1, day._id.day);
            const dayEnd = new Date(day._id.year, day._id.month - 1, day._id.day + 1);

            const orders = await Order.find({
            status: 'delivered',
            createdAt: { $gte: dayStart, $lt: dayEnd }
            }).populate('items.product');

            let totalIncome = 0;
            orders.forEach(order => {
            order.items.forEach(item => {
                if (item.product) {
                totalIncome += item.product.price * item.quantity;
                }
            });
            });

            return {
            date: dayStart.toISOString().split('T')[0],
            totalIncome: Math.round(totalIncome * 100) / 100,
            orderCount: day.orderCount
            };
        })
        );

        res.json({
        period: {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        },
        dailyIncome: detailedIncome
        });

    } catch (error) {
        console.error('Error calculating daily income:', error);
        res.status(500).json({ error: 'Failed to calculate daily income', details: error.message });
    }
    });




    router.get('/analytics/product-income-percentage', async (req, res) => {
    try {
        const { adminId, year, month } = req.query;


        const admin = await User.findById(adminId);
        if (!admin || admin.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized. Admin access required' });
        }


        const targetYear = year ? parseInt(year) : new Date().getFullYear();
        const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
        
        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);


        const orders = await Order.find({
        status: 'delivered',
        createdAt: { $gte: startDate, $lte: endDate }
        }).populate('items.product');


        const productIncome = {};
        let totalIncome = 0;

        orders.forEach(order => {
        order.items.forEach(item => {
            if (item.product) {
            const productId = item.product._id.toString();
            const itemIncome = item.product.price * item.quantity;
            
            if (!productIncome[productId]) {
                productIncome[productId] = {
                name: item.product.name,
                totalIncome: 0,
                quantitySold: 0
                };
            }
            
            productIncome[productId].totalIncome += itemIncome;
            productIncome[productId].quantitySold += item.quantity;
            totalIncome += itemIncome;
            }
        });
        });


        const productPercentages = Object.values(productIncome).map(product => ({
        name: product.name,
        totalIncome: Math.round(product.totalIncome * 100) / 100,
        quantitySold: product.quantitySold,
        percentage: totalIncome > 0 
            ? Math.round((product.totalIncome / totalIncome) * 10000) / 100 
            : 0
        })).sort((a, b) => b.percentage - a.percentage);

        res.json({
        period: {
            year: targetYear,
            month: targetMonth,
            monthName: new Date(targetYear, targetMonth - 1).toLocaleString('default', { month: 'long' })
        },
        totalIncome: Math.round(totalIncome * 100) / 100,
        productBreakdown: productPercentages
        });

    } catch (error) {
        console.error('Error calculating product income percentage:', error);
        res.status(500).json({ error: 'Failed to calculate product income percentage', details: error.message });
    }
    });




    router.get('/analytics/product-order-percentage', async (req, res) => {
    try {
        const { adminId, year, month } = req.query;


        const admin = await User.findById(adminId);
        if (!admin || admin.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized. Admin access required' });
        }


        const targetYear = year ? parseInt(year) : new Date().getFullYear();
        const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
        
        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);


        const orders = await Order.find({
        status: { $in: ['delivered', 'ready', 'out_for_delivery', 'preparing'] },
        createdAt: { $gte: startDate, $lte: endDate }
        }).populate('items.product');


        const productOrderCount = {};
        let totalProductInstances = 0;

        orders.forEach(order => {
        order.items.forEach(item => {
            if (item.product) {
            const productId = item.product._id.toString();
            
            if (!productOrderCount[productId]) {
                productOrderCount[productId] = {
                name: item.product.name,
                orderCount: 0,
                totalQuantity: 0
                };
            }
            
            productOrderCount[productId].orderCount += 1;
            productOrderCount[productId].totalQuantity += item.quantity;
            totalProductInstances += 1;
            }
        });
        });


        const productPercentages = Object.values(productOrderCount).map(product => ({
        name: product.name,
        orderCount: product.orderCount,
        totalQuantity: product.totalQuantity,
        percentage: totalProductInstances > 0 
            ? Math.round((product.orderCount / totalProductInstances) * 10000) / 100 
            : 0
        })).sort((a, b) => b.percentage - a.percentage);

        res.json({
        period: {
            year: targetYear,
            month: targetMonth,
            monthName: new Date(targetYear, targetMonth - 1).toLocaleString('default', { month: 'long' })
        },
        totalOrders: orders.length,
        totalProductInstances,
        productBreakdown: productPercentages
        });

    } catch (error) {
        console.error('Error calculating product order percentage:', error);
        res.status(500).json({ error: 'Failed to calculate product order percentage', details: error.message });
    }
    });
}

module.exports = main;