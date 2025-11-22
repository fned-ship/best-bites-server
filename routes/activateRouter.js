let User = require('../models/user');

let activateRouter=(app)=>{
    app.post('/activate',(req,res)=>{
        let securitycode= req.body.securitycode;
        User.findOne({ SecurityCode : securitycode  })
        .then(collection=>{
            if(!!collection){
                collection.SecurityCode=String(Date.now())+String(Math.random());
                collection.isActive=true;
                collection.save()
                .then(() => res.status(200).json('verified'))
                .catch(err => res.status(400).json('Error: ' + err));
            }else{
                res.status(200).json("unverified")
            }
        })
    })
}


module.exports = activateRouter;