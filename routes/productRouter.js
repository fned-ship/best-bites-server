const User = require('../models/user');
const Product = require('../models/product');
const Order = require('../models/order');
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


const productRouter=(router)=>{
    router.get('/products/:productId', async (req, res) => {
    try {
        const { productId } = req.params;

        const product = await Product.findById(productId)
        .populate('ingredients.stock');

        if (!product) {
        return res.status(404).json({ error: 'Product not found' });
        }

        res.json({
        message: 'Product fetched successfully',
        product
        });

    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Failed to fetch product', details: error.message });
    }
    });


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
    
    
    router.put('/products/:productId', upload.single('image'), async (req, res) => {
        try {
            const { productId } = req.params;
            const { adminId, ...updateData } = req.body;

            // Validate admin
            const admin = await User.findById(adminId);
            if (!admin || admin.role !== 'admin') {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(403).json({ error: 'Unauthorized. Admin access required' });
            }

            // Parse ingredients if received as a JSON string
            if (typeof updateData.ingredients === 'string') {
            try {
                updateData.ingredients = JSON.parse(updateData.ingredients);
            } catch (err) {
                if (req.file) fs.unlinkSync(req.file.path);
                return res.status(400).json({ error: 'Invalid ingredients JSON format' });
            }
            }

            // Fetch product
            const product = await Product.findById(productId);
            if (!product) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Product not found' });
            }

            // Handle image update
            if (req.file) {
            // Delete old image if not default
            if (product.image && product.image !== '/products/default-product.png') {
                const oldPath = path.join(__dirname, '../public', product.image);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }

            updateData.image = `/products/${req.file.filename}`;
            }

            // Update product
            const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            updateData,
            { new: true, runValidators: true }
            );

            res.json({
            message: 'Product updated successfully',
            product: updatedProduct
            });

        } catch (error) {
            console.error('Error updating product:', error);

            if (req.file) fs.unlinkSync(req.file.path);

            res.status(500).json({ 
            error: 'Failed to update product', 
            details: error.message 
            });
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
}

module.exports=productRouter ;