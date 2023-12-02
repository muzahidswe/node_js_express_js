const Dh = require("../Models/Dh");
const { sendApiResult } = require("./helperController")

exports.getDh = async (req,res)=>{
    try {
        const dh = await Dh.getDh();
        res.status(200).send(dh);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.dhWiseFiList = async (req,res)=>{
    try {
        const dh = await Dh.dhWiseFiList();
        res.status(200).send(dh);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.deactivateFiDhRelation = async (req, res) => {
    try {
        var result = await Dh.deactivateFiDhRelation(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
} 

exports.activateFiDhRelation = async (req, res) => {
    try {
        var result = await Dh.activateFiDhRelation(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}