let User = require('../models/user');
const bcrypt = require('bcrypt');

let loginRouter=(app)=>{
    app.post('/login',(req,res)=>{
        const email= req.body.email ;
        const password=req.body.password ;
        
        User.findOne({ email : email  })
        .then(collection=>{
            if(!!collection){
                bcrypt.compare(password , collection.password , function(err, result) {
                    if (result === true) {
                        // Passwords match
                        res.status(200).json({
                            res:'correct password',
                            user:collection
                        });
                    } else {
                        // Passwords do not match
                        res.status(200).json({res : 'incorrect password'});
                    }
                });
            }else{
                res.status(200).json({res:"invalid email adress"});
            }
        })
    })
}

module.exports = loginRouter;