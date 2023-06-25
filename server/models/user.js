const mongoose = require('mongoose')

const Schmea = mongoose.Schema

const userSchema = new Schmea({
    username: {
        type: String,
    },
    email: {
        type: String
    },
    password: {
        type: String
    }
},{timestamps:true})

module.exports = mongoose.model('User',userSchema)