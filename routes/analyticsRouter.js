const User = require('../models/user');
const Order = require('../models/order');


const analyticsRouter=(router)=>{
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
                status:{$in :['delivered','recieved']},
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
                status: {$in :['delivered','recieved']},
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
            status: {$in :['delivered','recieved']},
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
            status: { $in: ['delivered','recieved' ,  'ready', 'out_for_delivery', 'preparing'] },
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

module.exports=analyticsRouter ;