const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const CommandSchema = new Schema({
    productId: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    }
}, { _id: true });

const historySchema = new Schema({
  idUser: { type: String , required: true },
  status: { type: String , required: true  },
  comment:{type :String , required:true },
  command : { type : [CommandSchema] , default:[] },
  id:{type:String, required: true },
}, {
  timestamps: true,
});

const History = mongoose.model('history', historySchema);

module.exports = History;