import mongoose from "mongoose";

const branchSchema = new mongoose.Schema({
    branchName:{
        type:String,
        required:true, 
        trim:true
    },
    apiKey:{
        type:String,
        required:true,
        unique:true,
        index:true
    },
    environment:{
        type:String,
        enum:['development','staging','production'],
        default:'production'
    },
},
{ timestamps: true }
);
const branch = mongoose.model('branch',branchSchema);
export default branch;