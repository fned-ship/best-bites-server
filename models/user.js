const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userSchema = new Schema({
  firstName: { type: String , required: true },
  lastName: { type: String , required: true },
  email: { type: String , required: true  },
  password: { type: String , required: true },
  birthDay: { type: Date , required: true },
  imageSrc:{type :String , required:true },
  SecurityCode : {type :String , required : true  },
  isActive:{type :Boolean , required : true  },
  number: { type: String , required: true },
  address: { type: String , required: true },
  role: { type: String , required: true },
  id:{type:String, required: true },
}, {
  timestamps: true,
});

userSchema.index({ email: 1 }); // Speeds up login queries by email
userSchema.index({ role: 1, isActive: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;