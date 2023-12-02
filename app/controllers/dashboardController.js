const { sendApiResult } = require("./helperController")
const dashboard = require("../Models/DashboardModel");

exports.getData = async(req,res)=>{
    try {        
        const result =await dashboard.getData(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}


exports.getDataV2 = async(req,res)=>{
    try {        
        const result =await dashboard.getDataV2(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}