const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const productSchema = new Schema({
  name: { type: String , required: true },
  type: { type: String , required: true },
  price: { type: Number , required: true  },
  imageSrc:{type :String , required:true },
  rating : {type :Number , required : true  },
  numOfCommands :{type :Number , required : true  },
  ingredients: { type: [String] , default: [] },
  id:{type:String, required: true },
}, {
  timestamps: true,
});

const Product = mongoose.model('product', productSchema);

module.exports = Product;