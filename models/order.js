const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderItemSchema = new Schema({
  product: {
    type: Schema.Types.ObjectId, 
    ref: 'Product',
    required: true 
  },
  quantity: { 
    type: Number, 
    required: true,
    min: 1
  },
  specialInstructions: String
}, { _id: false });

const orderSchema = new Schema({
  orderNumber: {
    type: String,
    unique: true,
  },
  customer: {
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    index: true
  },
  chatId: {
    type: String, 
    index: true
  },
  deliverer: {
    type: Schema.Types.ObjectId, 
    ref: 'User',
    index: true
  },
  items: {
    type: [orderItemSchema],
    validate: [arr => arr.length > 0, 'Order must have at least one item']
  },
  status: {
    type: String,
    enum: ['confirmed','ready', 'out_for_delivery', 'delivered', 'recieved'],
    default: 'pending',
    index: true
  },
  deliveryAddress: {
    type:String ,
    required:true 
  },
  customerNotes: String,
}, { 
  timestamps: true
});


orderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `ORD-${Date.now()}-${count + 1}`;
  }
  next();
});

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
// orderSchema.index({ orderNumber: 1 });






const Order = mongoose.model('Order', orderSchema);
module.exports = Order;