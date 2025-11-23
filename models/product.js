const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ingredientSchema = new Schema({
  stock: {
    type: Schema.Types.ObjectId, 
    ref: 'Stock',
    required: true 
  },
  quantity: {
    type: Number, 
    required: true,
    min: 0
  }
}, { _id: false });

const productSchema = new Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String, 
    required: true,
    enum: ['appetizer', 'main_course', 'dessert', 'beverage', 'side_dish'],
    index: true
  },
  price: { 
    type: Number, 
    required: true,
    min: 0
  },
  image: {
    type: String,
    default: '/default-product.png'
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  orderCount: {
    type: Number,
    default: 0
  },
  ingredients: {
    type: [ingredientSchema],
    default: []
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
}, { 
  timestamps: true
});


productSchema.index({ category: 1, isAvailable: 1 });
productSchema.index({ 'rating.average': -1 });
productSchema.index({ orderCount: -1 });

const Product = mongoose.model('Product', productSchema);
module.exports = Product;