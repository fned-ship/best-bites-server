const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const stockSchema = new Schema({
  name: { type: String , required: true },
  quantity: { type: Number , required: true  },
  dailyIncome:{type :Number , required:true },
  minimum : {type :Number , required : true  },
  id:{type:String, required: true },
}, {
  timestamps: true,
});

const Stock = mongoose.model('stock', stockSchema);

module.exports = Stock;