const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const stockSchema = new Schema({
  name: { 
    type: String, 
    required: true,
    unique: true,
    trim: true
  },
  quantity: { 
    type: Number, 
    required: true,
    min: 0,
    default: 0
  },
  unit: {
    type: String,
    enum: ['kg', 'g', 'l', 'ml', 'pieces', 'units'],
    required: true
  },
  costPerUnit: {
    type: Number,
    required: true,
    min: 0
  },
  minThreshold: {
    type: Number,
    required: true,
    min: 0
  },
  supplier: {
    name: String,
    contact: String
  },
  lastRestocked: {
    type: Date,
    default: Date.now
  },
  category: {
    type: String,
    enum: ['vegetables', 'meat', 'dairy', 'spices', 'beverages', 'other'],
    default: 'other'
  }
}, { 
  timestamps: true
});


stockSchema.virtual('status').get(function() {
  if (this.quantity === 0) return 'out_of_stock';
  if (this.quantity <= this.minThreshold) return 'low_stock';
  return 'in_stock';
});

stockSchema.index({ name: 1 });
stockSchema.index({ category: 1 });




const Stock = mongoose.model('Stock', stockSchema);
module.exports = Stock;