const User = require('../models/user');
const Stock = require('../models/stock');
const Product = require('../models/product');


const stockRouter=(router)=>{

    router.get('/stocks/:stockId', async (req, res) => {
    try {
        const { stockId } = req.params;

        const stock = await Stock.findById(stockId);

        if (!stock) {
        return res.status(404).json({ error: 'Stock not found' });
        }


        const stockWithStatus = {
        ...stock.toObject(),
        status: stock.status
        };

        res.json({
        message: 'Stock fetched successfully',
        stock: stockWithStatus
        });

    } catch (error) {
        console.error('Error fetching stock:', error);
        res.status(500).json({ error: 'Failed to fetch stock', details: error.message });
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
}
module.exports=stockRouter ;