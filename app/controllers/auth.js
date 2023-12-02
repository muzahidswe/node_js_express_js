const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const knex = require('../config/database')
const md5 = require('md5')
exports.register = (req, res) => {

    const { name, email, phone, password, passconfirm } = req.body;  //Instead of the lines const name = req.body.name; ... we can write them in a single line
    //let hashedPass = bcrypt.hashSync(password, 4); // Here 4 is for, how many times we are hashing the password. You can use 5/6...
    let hashedPass = md5("++" + password + "--");

    knex('cr_users').insert([
        { name: name, email: email, phone: phone, password: hashedPass }
    ])
        .then(data => res.json(data))
        .catch((err) => { res.json(err); throw err })
        .finally(() => {
            knex.destroy();
        });
}

exports.refreshToken = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400);
    }
    const data = await knex('cr_users')
        .select('id', 'name', 'email', 'phone', 'cr_user_type', 'password', 'id_fi', 'remember_token')
        .where({ 'email': email })
        .first()
        .catch((err) => res.json({
            result: false,
            message: err
        }));
    if (data.remember_token != req.body.refreshToken) {
        return res.sendStatus(401)
    }
    delete data.remember_token;
    const payload = { data };
    const options = { expiresIn: process.env.JWT_EXPIRES_IN };
    const secret = process.env.JWT_SECRET;
    const token = jwt.sign(payload, secret, options);
    const refreshOptions = { expiresIn: process.env.REFRESH_TOKEN_LIFE };
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET;
    const refreshToken = jwt.sign(payload, refreshSecret, refreshOptions);
    await knex("cr_users").where('id', data.id).update({
        remember_token: refreshToken
    });
    const output = {token, refreshToken};
    return res.json(output);
}

exports.login = async (req, res) => {
	console.log("login", req.ip);
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400);
    }

    const data = await knex('cr_users')
		.select('id', 'name', 'email', 'phone', 'cr_user_type', 'password', 'id_fi', 'setting_menu')
        .where({ 'email': email, 'activation_status': 'Active' })
        .first()
        .catch((err) => res.json({
            result: false,
            message: err
        }));
    //console.log(data);
    if (!data || !(md5("++" + password + "--") == data.password)) {
        res.json({
            result: false,
            message: "Invalid email or password"
        })
    } else {
        delete data.password;
        
        const payload = { data };
        const options = { expiresIn: process.env.JWT_EXPIRES_IN };
        const secret = process.env.JWT_SECRET;
        const token = jwt.sign(payload, secret, options);
        const refreshOptions = { expiresIn: process.env.REFRESH_TOKEN_LIFE };
        const refreshSecret = process.env.REFRESH_TOKEN_SECRET;
        const refreshToken = jwt.sign(payload, refreshSecret, refreshOptions);
        await knex("cr_users").where('id', data.id).update({
            remember_token: refreshToken
        });
        const permitted_menues = await knex('cr_menus')
        .select('cr_menus.id','cr_menus.parent_menu_id','cr_menus.name','cr_menus.icon','cr_menus.url')
        .leftJoin('cr_menu_vs_role', 'cr_menu_vs_role.id_cr_menu', 'cr_menus.id')
        .leftJoin('cr_roles', 'cr_roles.id', 'cr_menu_vs_role.id_cr_role')
        .leftJoin('cr_role_vs_user', 'cr_role_vs_user.id_cr_role', 'cr_roles.id')
        .leftJoin('cr_users', 'cr_users.id', 'cr_role_vs_user.id_cr_user')
        .where('cr_menus.activation_status', 'Active')
        .where('cr_users.id', data.id)
        .orderBy('cr_menus.sorting_order', 'asc');
		
		var dp_id_not = []; dh_id_not = [];
		if(data.cr_user_type != 'apsis_support'){
			dp_id_not = [334,344];
			dh_id_not = [57];
		}
		
		const permitted_fi_info = await knex('cr_user_fi_mapping')
					.select("ids_fi", "default_fi", "multi_access")
					.where("id_user", data.id);
		
        if (data.cr_user_type == 'bat') {
            const dh_id = await knex('cr_dh_user')
                                .select("dh_id")
                                .where("cr_user_id", data.id)
								.whereNotIn("dh_id", dh_id_not)
                                .pluck("dh_id");
            var dpids = await knex("distributorspoint")
                        .select("id")
                        .whereIn("dsid", dh_id)
						.whereNotIn("dsid", dh_id_not)
						.whereNotIn("id", dp_id_not)
                        .where("stts", 1)
                        .pluck('id');
            data.dpids = dpids;
            data.dh_id = dh_id;
        } else if(data.cr_user_type == 'superadmin' || data.cr_user_type == 'apsis_support'){			
            const dh_id = await knex('company')
                                .select("id")
                                .where("stts", 1)
								
                                .pluck("id");
            var dpids = await knex("distributorspoint")
                        .select("id")
                        .whereIn("dsid", dh_id)
						.whereNotIn("dsid", dh_id_not)
						.whereNotIn("id", dp_id_not)
                        .where("stts", 1)
                        .pluck('id');
            data.dpids = dpids;
            data.dh_id = dh_id;
        }else if(data.cr_user_type == 'admin'){
            const dh_id = await knex('cr_dh_user')
                                .select("dh_id")
                                .where("cr_user_id", data.id)
                                .pluck("dh_id");
            var dpids = await knex("distributorspoint")
                        .select("id")
                        .whereIn("dsid", dh_id)
						.whereNotIn("dsid", dh_id_not)
						.whereNotIn("id", dp_id_not)
                        .where("stts", 1)
                        .pluck('id');
            data.dpids = dpids;
            data.dh_id = dh_id;
        }else{
            const dh_id =  await knex("cr_dh_fi")
                    .select("id_dh")
                    .where({
                        id_fi: data.id_fi,
                        activation_status: "Active"
                    })
					.whereNotIn("id_dh", dh_id_not)
                    .pluck('id_dh');
                    
            dpids = await knex("distributorspoint")
                .select("id")
                .whereIn("dsid", dh_id)
				.whereNotIn("dsid", dh_id_not)
				.whereNotIn("id", dp_id_not)
                .where("stts", 1)
                .pluck('id');
            data.dh_id = dh_id;
            data.dpids = dpids;
        }
		
		if(permitted_fi_info.length > 0) {
			data.permitted_fi = permitted_fi_info;
			data.fi_info = await knex('cr_fi_institute').select("id", "name").whereIn("id", permitted_fi_info[0].ids_fi.split(','));
		}
        
        //console.log(data.dh_id.dh_id)
        //data.permitted_menues = permitted_menues;
        data.permitted_menu_tree = menuTree(permitted_menues);        
        data.token = token;
        data.refreshToken = refreshToken;
        data.result = true;        
        return res.json(data);
    }
}

exports.base64_decode = async (req, res) => {
	const base64 = req.body.base64;	
	try{
		const buff = Buffer.from(base64, 'base64');
		const str = buff.toString('utf-8');
		const email = (str.replace('hrms', '')).replace('credit', '');
		const data = {
			"email" : email + '@cr.com',
			"password" : 123456,
			"user_type" : "admin",
			"login_type" : "commonLogin"
		}
		return res.json(data);
	} catch (error) {
		return res.json({});
	}	
}

exports.commonLogin = async (req, res) => {
	const email = req.body.email;
	const password = req.body.password;
	
	if(req.body.login_type != 'commonLogin'){
		res.json({
			result: false,
			message: "You are not supposed to Login in Unnoti"
		});
	}
	
	if (!email || !password) {
        return res.status(400);
    }

	const data = await knex('cr_users')
		.select('id', 'name', 'email', 'phone', 'cr_user_type', 'password', 'id_fi', 'setting_menu')
		.where({ 'email': email, 'cr_user_type' : req.body.user_type, 'activation_status' : 'Active'})
		.first()
		.catch((err) => res.json({
			result: false,
			message: err
		}));

	if (!data) {
		res.json({
			result: false,
			message: "Invalid email or password"
		});
	} else {        
		const payload = { data };
		const options = { expiresIn: process.env.JWT_EXPIRES_IN };
		const secret = process.env.JWT_SECRET;
		const token = jwt.sign(payload, secret, options);
		const refreshOptions = { expiresIn: process.env.REFRESH_TOKEN_LIFE };
		const refreshSecret = process.env.REFRESH_TOKEN_SECRET;
		const refreshToken = jwt.sign(payload, refreshSecret, refreshOptions);
		await knex("cr_users").where('id', data.id).update({
			remember_token: ""+refreshToken+""
		});
		const permitted_menues = await knex('cr_menus')
		.select('cr_menus.id','cr_menus.parent_menu_id','cr_menus.name','cr_menus.icon','cr_menus.url')
		.leftJoin('cr_menu_vs_role', 'cr_menu_vs_role.id_cr_menu', 'cr_menus.id')
		.leftJoin('cr_roles', 'cr_roles.id', 'cr_menu_vs_role.id_cr_role')
		.leftJoin('cr_role_vs_user', 'cr_role_vs_user.id_cr_role', 'cr_roles.id')
		.leftJoin('cr_users', 'cr_users.id', 'cr_role_vs_user.id_cr_user')
		.where('cr_menus.activation_status', 'Active')
		.where('cr_users.id', data.id)
		.orderBy('cr_menus.sorting_order', 'asc');

		if(data.cr_user_type == 'admin'){
			const dh_id = await knex('cr_dh_user')
								.select("dh_id")
								.where("cr_user_id", data.id)
								.pluck("dh_id");
			var dpids = await knex("distributorspoint")
						.select("id")
						.whereIn("dsid", dh_id)
						.where("stts", 1)
						.pluck('id');
			data.dpids = dpids;
			data.dh_id = dh_id;
		}      
		data.permitted_menu_tree = menuTree(permitted_menues);        
		data.token = token;
		data.refreshToken = refreshToken;
		data.result = true;     
		return res.json(data);
	}
}

function menuTree(menus, parent_menu_id = 0) { 
    var branch = [];
    for (let i = 0; i < menus.length; i++) {
        var temp = menus[i];
        if (menus[i].parent_menu_id == parent_menu_id) {
            var children = menuTree(menus, menus[i].id);
            if (children) {
                temp.children = children;
            }
            branch.push(temp);
        }        
    }
    return JSON.stringify(branch);
}