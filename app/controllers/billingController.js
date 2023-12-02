const { sendApiResult } = require("./helperController");
const billing = require("../Models/BillingModel");

exports.getDhBillingInfo = async(req,res)=>{
    try {        
        const result =await billing.getDhBillingInfo(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.submittedDhBillingInfo = async(req,res)=>{
    try {        
        const result =await billing.submittedDhBillingInfo(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.downloadDhBillingInfo = async(req,res)=>{
    try {        
        const result =await billing.downloadDhBillingInfo(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.submitDhBillingInfo = async(req,res)=>{
    try {        
        const result =await billing.submitDhBillingInfo(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.downloadDhBillingHistory = async(req,res)=>{
    try {        
        const result =await billing.downloadDhBillingHistory(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}