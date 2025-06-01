const mongoose = require("mongoose");

mongoose.connect("mongodb+srv://mehul:mehul5451@cluster0.4awickr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
.then(()=>
{
    console.log("mongodb connected succesfully");   
})
.catch((err) =>
{
    console.log("error during mongo db connection",err);
    
})


//mongodb+srv://mehul:<db_password>@cluster0.4awickr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
