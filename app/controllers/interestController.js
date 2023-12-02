const Interest = require("../Models/InterestModel");
const { sendApiResult } = require("./helperController")


exports.insertInterestSettings =async (req,res)=>{
    try {
        
        const insert = await Interest.insertInterestSettings(req.body);
        res.status(200).send(insert);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.deleteCrLimitConfig = async (req, res) => {
    try {        
        const deleteConfig = await Interest.deleteCrLimitConfig(req.params.id);
        res.status(200).send(deleteConfig);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.getUploadedInterestSettings = async(req,res)=>{
    try {
        
        const settings = await Interest.getUploadedInterestSettings(req.body);
        res.status(200).send(settings);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.interestSettingsUpdateByPoint = async(req,res)=>{
    try {        
        const interestSettingsUpdateByPoint = await Interest.interestSettingsUpdateByPoint(req);
        res.status(200).send(interestSettingsUpdateByPoint);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.interestSettingsDeleteByPoint = async(req,res)=>{
    try {        
        const interestSettingsDeleteByPoint = await Interest.interestSettingsDeleteByPoint(req);
        res.status(200).send(interestSettingsDeleteByPoint);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.interestSettingsByPoint = async(req,res)=>{
    try {        
        const interestSettingsByPoint = await Interest.interestSettingsByPoint(req);
        res.status(200).send(interestSettingsByPoint);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}