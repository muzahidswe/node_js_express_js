const Fi = require("../Models/Fi");
const { sendApiResult } = require("./helperController")

exports.insertFiInstitute = async (req,res)=>{

    try {
        const fi = await Fi.insertFiInstitute(req);
        console.log(req.body);
        res.status(200).send(fi);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}
exports.getFi = async(req,res)=>{
    try {
        const fi = await Fi.getFi();
        res.status(200).send(fi);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.editFi = async(req,res)=>{
    try {
        const fi = await Fi.editFi(req);
        res.status(200).send(fi);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.deleteFi = async(req,res)=>{
    try {
        const fi = await Fi.deleteFi(req.body);
        res.status(200).send(fi);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.dhFiMapping = async(req,res)=>{
    try {
        const dhFi = await Fi.dhFiMapping(req.body);
        res.status(200).send(dhFi);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.getDocuments = async (req, res) => {
    try {
        const docs = await Fi.getDocuments();
        res.status(200).send(docs);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.getDocumentsFiWise = async (req, res) => {
    try {
        const docFi = await Fi.getDocumentsFiWise();
        res.status(200).send(docFi);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.deleteFiDocRelation = async (req, res) => {
    try {
        const deleteRelation = await Fi.deleteFiDocRelation(req.params.id);
        res.status(200).send(deleteRelation);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.posFiDocMappingUrl = async (req, res) => {
    try {
        const insert = await Fi.posFiDocMappingUrl(req.body);
        res.status(200).send(insert);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.deactivateFiTransaction = async (req, res) => {
    try {
        const insert = await Fi.deactivateFiTransaction(req.body);
        res.status(200).send(insert);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}
exports.activateFiTransaction = async (req, res) => {
    try {
        const insert = await Fi.activateFiTransaction(req.body);
        res.status(200).send(insert);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}