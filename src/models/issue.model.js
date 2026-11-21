import mongoose from "mongoose";

const issueSchema = new mongoose.Schema({
    fingerprint: {
        type:String,
        required:true,
        unique:true,
        index:true
    },
    title: {
        type:String,
        required:true,
        trim:true
    },
    stackTrace: {
        type:String,
        required:true
    },
    count : {
        type:Number,
        default:1
    },
    status:{
        type:String,
        enum:['UNRESOLVED','IN_PROGRESS','RESOLVED'],
        default:'UNRESOLVED'
    },
    firstSeen: {
        type:Date,
        default:Date.now
    },
    lastSeen: {
        type:Date,
        default:Date.now
    },
},
{
    timestamps:true
});
const issue = mongoose.model('issue',issueSchema);
export default issue;