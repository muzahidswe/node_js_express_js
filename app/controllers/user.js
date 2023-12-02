const knex = require('../config/database')
const { sendApiResult } = require('./helperController')
const User = require("../Models/User");

exports.userList =async (req, res) =>{
    try {
        const users = await User.getUserList();
        res.status(200).send(users);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.getLocationBasedOnPermission =async (req,res)=>{
    try {
        const result = await User.getLocationBasedOnPermission(req.body);
        res.status(200).send(result);

    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.getOutletByPoint = async (req, res) => {
    try {
        const result = await User.getOutletByPoint(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message))
    }
}

exports.getLocationBasedOnPermissionForReport = async (req,res)=>{
    try {
        const result = await User.getLocationBasedOnPermissionForReport(req.body);
        res.status(200).send(result);

    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.getLocationsFiDiWise = async (req, res) =>{
    try {
        console.log(req.body);
        const result = await User.getLocationsFiDiWise(req.body);
        res.status(200).send(result);

    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.getUserById = async (req, res) =>{
    try {
        const result = await User.getUserById(req.params.id);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}
exports.changePass = async (req, res) => {
    try {
        const result = await User.changePass(req);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.createUser = async (req, res) => {
    try {
        const result = await User.createUser(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.userDelete = async (req, res) => {
    try {
        const result = await User.userDelete(req.params.id);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}