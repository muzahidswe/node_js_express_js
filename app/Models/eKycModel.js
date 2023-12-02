const {
	sendApiResult,
	generaeteExcel,
	timeout,
	generateBlobDownloadURL
} = require('../controllers/helperController')
const { rejects } = require('assert')
const { resolve } = require('path')
const { send, title } = require('process')
const { groupBy, where } = require('../config/database')
const knex = require('../config/database')
var moment = require('moment')
const fs = require('fs');
const request = require('request');
const FormData = require('form-data');
const fetch = require('node-fetch');
const excel = require('excel4node');

let eKyc = function () { }

eKyc.nidInfoChecking = function (req) {
	return new Promise(async (resolve, reject) => {
		try {
			// resolve(sendApiResult(true, "NID এর ছবি সফল ভাবে রেকর্ড হয়েছে।", []));
			const base64Data = req.base64_data;
			const image_path = process.env.PUBLIC_URL + 'eKyc_documents/NID/' + req.retailer_code + '/';
			const nid_image_name = req.user_type + '_' + req.imageSide + '.png';
			await base64_to_image(base64Data, image_path, nid_image_name);
			const log_id = await curlPostRequestWithFile(req, req.imageSide, image_path, nid_image_name);
			const retailerNidInfo = await retailer_nid_info(log_id);
			fs.unlinkSync(image_path + nid_image_name);
			if (Object.keys(retailerNidInfo).length > 0) {
				resolve(sendApiResult(true, "NID তথ্য সফলভাবে খুঁজে পাওয়া গেছে।", retailerNidInfo[0]));
			} else {
				reject(sendApiResult(false, "NID তথ্য সফলভাবে খুঁজে পাওয়া যায়নি। আবার চেষ্টা করুন"));
			}
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	})
}

eKyc.nidInfoDetails = function (id) {
	return new Promise(async (resolve, reject) => {
		try {
			const retailerNidInfo = await retailer_nid_details(id);
			if (Object.keys(retailerNidInfo).length > 0) {
				resolve(sendApiResult(true, "NID তথ্য সফলভাবে খুঁজে পাওয়া গেছে।", retailerNidInfo[0]));
			} else {
				reject(sendApiResult(false, "NID তথ্য সফলভাবে খুঁজে পাওয়া যায়নি। আবার চেষ্টা করুন"));
			}
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	})
}

eKyc.nidInfoList = function (req) {
	return new Promise(async (resolve, reject) => {
		try {
			const retailerNidInfo = await retailer_nid_details(req, '');
			if (Object.keys(retailerNidInfo).length > 0) {
				resolve(sendApiResult(true, "NID তথ্য সফলভাবে খুঁজে পাওয়া গেছে।", retailerNidInfo));
			} else {
				reject(sendApiResult(false, "NID তথ্য সফলভাবে খুঁজে পাওয়া যায়নি। আবার চেষ্টা করুন"));
			}
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	})
}

eKyc.downloadeKycOutletList = function (req) {
	return new Promise(async (resolve, reject) => {
		const result = await eKyc.nidInfoList(req);
		if (result.data.length == 0) {
			reject(sendApiResult(false, "No eKYC Outlet Found."));
		} else {
			const today = moment(new Date()).format('YYYY-MM-DD');
			var workbook = new excel.Workbook();
			var worksheet = workbook.addWorksheet("eKYC Outlet List (" + today + ")");
			var headerStyle = workbook.createStyle({
				fill: {
					type: "pattern",
					patternType: "solid",
					bgColor: "#E1F0FF",
					fgColor: "#E1F0FF"
				},
				font: {
					color: "#000000",
					size: "10",
					bold: true
				}
			});

			var headers = [
				"Sr.",
				"Region",
				"Area",
				"House",
				"Territory",
				"Point",
				"Outlet Code",
				"Outlet Name",
				"Owner Name",
				"NID Name",
				"NID Name (Bangla)",
				"NID No",
				"NID Type",
				"Phone No.",
				"Date of Birth",
				"Father's Name",
				"Mother's Name",
				"Present Address",
				"Permanent Address",
				"eKYC Date",
				"eKYC Time",
				// "NID Photo"
			];

			var col = 1;
			var row = 1;
			var col_add = 0;

			headers.forEach((e) => {
				worksheet
					.cell(row, col + col_add)
					.string(e)
					.style(headerStyle);
				col_add++;
			});

			row = 2;
			for (let i = 0; i < result.data.length; i++) {
				var col_add = 0;
				let e = result.data[i];
				worksheet.cell(row, col + col_add).number((i + 1));
				col_add++;
				worksheet.cell(row, col + col_add).string(e.region ? e.region : "");
				col_add++;
				worksheet.cell(row, col + col_add).string(e.area ? e.area : "");
				col_add++;
				worksheet.cell(row, col + col_add).string(e.dh_name ? e.dh_name : "");
				col_add++;
				worksheet.cell(row, col + col_add).string(e.territory ? e.territory : "");
				col_add++;
				worksheet.cell(row, col + col_add).string(e.dp_name ? e.dp_name : "");
				col_add++;
				worksheet.cell(row, col + col_add).string(e.retailer_code ? e.retailer_code : "");
				col_add++;
				worksheet.cell(row, col + col_add).string(e.outlet_name ? e.outlet_name : "");
				col_add++;
				worksheet.cell(row, col + col_add).string(e.owner_name ? e.owner_name : "");
				col_add++;
				worksheet.cell(row, col + col_add).string(e.name_eng ? e.name_eng : "");
				col_add++;
				worksheet.cell(row, col + col_add).string(e.name_bn ? e.name_bn : "");
				col_add++;
				worksheet.cell(row, col + col_add).string(e.nid_no ? e.nid_no : "");
				col_add++;
				worksheet.cell(row, col + col_add).string(e.nid_type ? e.nid_type : "");
				col_add++;
				worksheet.cell(row, col + col_add).string(e.kyc_phone ? e.kyc_phone : "");
				col_add++;
				worksheet.cell(row, col + col_add).string(e.dob ? e.dob : "");
				col_add++;
				worksheet.cell(row, col + col_add).string(e.father_eng ? e.father_eng : "");
				col_add++;
				worksheet.cell(row, col + col_add).string(e.mother_eng ? e.mother_eng : "");
				col_add++;
				worksheet.cell(row, col + col_add).string(e.present_addr_eng ? e.present_addr_eng : "");
				col_add++;
				worksheet.cell(row, col + col_add).string(e.permanent_addr_eng ? e.permanent_addr_eng : "");
				col_add++;
				worksheet.cell(row, col + col_add).string(e.kyc_date ? e.kyc_date : "");
				col_add++;
				worksheet.cell(row, col + col_add).string(e.kyc_time ? e.kyc_time : "");
				col_add++;
				// worksheet.cell(row, col + col_add).string(e.nid_photo ? e.nid_photo : "");
				// col_add++;
				row++;
			}
			const file_path = process.env.PUBLIC_URL + 'eKyc_documents/';
			if (!fs.existsSync(file_path)) {
				fs.mkdirSync(file_path, { recursive: true });
			}
			workbook.write(file_path + "eKYC Outlet List (" + today + ").xlsx");
			const fileName = "eKyc_documents/eKYC Outlet List (" + today + ").xlsx";
			const url = generateBlobDownloadURL(fileName);
			await timeout(1500);
			resolve(sendApiResult(true, "eKYC Outlet Documents Download", url));
		}
	})
}

const retailer_nid_details = async function (req, id = '') {
	const query = await knex("cr_retailer_nid_info")
		.select(
			"cr_retailer_nid_info.id",
			"region.slug AS region",
			"area.slug AS area",
			"company.name AS dh_name",
			"territory.slug AS territory",
			"distributorspoint.name AS dp_name",
			"cr_retailer_nid_info.retailer_code",
			"retailers.name AS outlet_name",
			"retailers.owner AS owner_name",
			"cr_retail_limit.phone AS kyc_phone",
			"cr_retailer_nid_info.nid_no",
			"cr_retailer_nid_info.name_bn",
			"cr_retailer_nid_info.name_eng",
			// "cr_retailer_nid_info.father_bn",
			"cr_retailer_nid_info.father_eng",
			// "cr_retailer_nid_info.mother_bn",
			"cr_retailer_nid_info.mother_eng",
			knex.raw(`DATE_FORMAT(cr_retailer_nid_info.dob, "%d %b %Y") AS dob`),
			"cr_retailer_nid_info.mother_eng",
			// "cr_retailer_nid_info.image_path",
			knex.raw(`DATE_FORMAT(cr_retailer_nid_info.created, "%d %b %Y") AS kyc_date`),
			knex.raw(`case cr_retailer_nid_info.nid_type WHEN 1 THEN 'Smart NID' ELSE 'Old NID' END as nid_type`),
			// "cr_retailer_nid_info.presentAddress_bn",
			"cr_retailer_nid_info.presentAddress_eng AS present_addr_eng",
			// "cr_retailer_nid_info.permanentAddress_bn",
			"cr_retailer_nid_info.permanentAddress_eng AS permanent_addr_eng",
			knex.raw(`DATE_FORMAT(cr_retailer_nid_info.created, "%h:%i:%s %p") AS kyc_time`),
			"cr_retailer_nid_info.image_path AS nid_photo"
		)
		// .innerJoin("retailers", "retailers.retailer_code", "cr_retailer_nid_info.retailer_code")
		.innerJoin("retailers", "retailers.id", "cr_retailer_nid_info.retailer_id")
		// .innerJoin("cr_retail_limit", "cr_retail_limit.outlet_code", "cr_retailer_nid_info.retailer_code")
		.innerJoin({ cr_retail_limit: "cr_retail_limit" }, "cr_retail_limit.id_outlet", "cr_retailer_nid_info.retailer_id")
		.innerJoin({ distributorspoint: "distributorspoint" }, "retailers.dpid", "distributorspoint.id")
		.innerJoin({ company: "company" }, "distributorspoint.dsid", "company.id")
		.innerJoin({ region: "_locations" }, "distributorspoint.region", "region.id")
		.innerJoin({ area: "_locations" }, "distributorspoint.area", "area.id")
		.innerJoin({ territory: "_locations" }, "distributorspoint.territory", "territory.id")
		.where(function () {
			this.where("retailers.stts", 1);
			this.where("cr_retailer_nid_info.status", 1);
			this.whereIn("retailers.dpid", req.dpids);
			if (id != '') {
				this.where("cr_retailer_nid_info.id", id);
			}
		})
		.orderBy("cr_retailer_nid_info.id", "DESC");
	return query;
}

const base64_to_image = async function (base64Data, image_path, image_name) {
	base64Data = base64Data.replace(/^data:image\/[a-z]+;base64,/, "");
	return new Promise(async (resolve, reject) => {
		try {
			if (!fs.existsSync(image_path)) {
				fs.mkdirSync(image_path, { recursive: true });
			}
			const image_path_and_name = image_path + image_name;
			require('fs').writeFile(image_path_and_name, base64Data, 'base64', function (err) {
				// console.log('base64Data to Image Conversion Successful');
				if (err == 'null') return true;
				else return err;
			});
			resolve(true);
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	})
}

const curlPostRequestWithFile = async function (req, imageSide, image_path, image_name) {
	return new Promise(async (resolve, reject) => {
		try {
			const saveLog = {
				'nid_type': req.type,
				'retailer_code': req.retailer_code,
				'sys_date': moment(new Date()).format('YYYY-MM-DD'),
				'status': 'pending',
				'created_by': req.user_id,
				// 'image_data' : (req.base64_data).replace(/^data:image\/[a-z]+;base64,/, ""),
				'image_size_kb': req.image_size
			};
			var cr_insert = await knex('cr_retailer_nid_info_check_log').insert(saveLog).returning('id');
			var save_log_id = cr_insert[0];

			// Start API Request
			const token = 'e24cb03b-86d2-4da6-8482-69639a91946b';
			const post_url = 'http://ekyc.mmautomation.live:8080/smartkyc/extract';
			const form = new FormData();
			form.append('type', req.type);
			form.append('imageSide', imageSide);
			form.append('file', fs.createReadStream(image_path + image_name), {
				contentType: 'image/png',
				filename: image_name
			});

			const request = await fetch(
				post_url,
				{
					method: 'POST',
					body: form,
					headers: {
						'token': token
					}
				}
			);

			var result = await request.json();
			var response = result.response;

			// Update API Response
			if (result.success == true && Object.keys(response.data.nid).length > 0) {
				const image_name = req.user_type + '_user.png';
				var userInfo = await saveUserInfo(save_log_id, req, response.data, (image_path + image_name));
				await knex('cr_retailer_nid_info_check_log').where('id', save_log_id)
					.update(
						{
							'status': 'success',
							'image_data': null,
							'response_status': response.status,
							'response_success': response.success,
							'response_msg': response.message
						});
				await base64_to_image(response.data.nid.photoUrl, image_path, image_name);
			} else {
				await knex('cr_retailer_nid_info_check_log').where('id', save_log_id)
					.update(
						{
							'status': 'failed',
							'response_status': response.status,
							'response_success': response.success,
							'response_msg': response.message
						});
			}

			resolve(save_log_id);
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	})
}

const saveUserInfo = async function (check_log_id, req, nid_info, image_path) {
	return new Promise(async (resolve, reject) => {
		try {

			var permenantAddressInfo = await addressInfoExtract(nid_info.nid.permenantAddressEN);
			var presentAddressInfo = await addressInfoExtract(nid_info.nid.presentAddressEN);

			const userInfo = {
				'info_check_log_id': check_log_id,
				'nid_type': req.type,
				'user_type': req.user_type,
				'retailer_id': req.retailer_id,
				'retailer_code': req.retailer_code,
				'nid_no': nid_info.nid.nationalIdNumber,
				'old_national_id_no': nid_info.nid.oldNationalIdNumber,
				'name_bn': nid_info.nid.fullNameBN,
				'name_eng': nid_info.nid.fullNameEN,
				'father_bn': nid_info.nid.fathersNameBN,
				'father_eng': nid_info.nid.fathersNameEN,
				'mother_bn': nid_info.nid.mothersNameBN,
				'mother_eng': nid_info.nid.mothersNameEN,
				'gender': await camelize(nid_info.nid.gender),
				'dob': await dateFormat(nid_info.nid.dateOfBirth),
				'profession': nid_info.nid.profession,
				'permanentAddress_bn': nid_info.nid.permanentAddressBN,
				'permanentAddress_eng': nid_info.nid.permenantAddressEN,
				'permanent_district_en': permenantAddressInfo.district,
				'permanent_birth_district_en': permenantAddressInfo.birth_district,
				'permanent_thana_en': permenantAddressInfo.thana,
				'permanent_postal_code_en': permenantAddressInfo.postal_code,
				'presentAddress_bn': nid_info.nid.presentAddressBN,
				'presentAddress_eng': nid_info.nid.presentAddressEN,
				'present_district_en': presentAddressInfo.district,
				'present_thana_en': presentAddressInfo.thana,
				'present_postal_code_en': presentAddressInfo.postal_code,
				'spouseName_bn': nid_info.nid.spouseNameBN,
				'spouseName_eng': nid_info.nid.spouseNameEN,
				'status': 1,
				'image_path': image_path,
				'created_by': req.user_id
			};
			await knex('cr_retailer_nid_info').where('retailer_code', req.retailer_code).update({ 'status': 0 })
			await knex('cr_retailer_nid_info').insert(userInfo);
			resolve(true);
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	})
}

const retailer_nid_info = async function (id = '') {
	const query = await knex("cr_retailer_nid_info")
		.select(
			"cr_retailer_nid_info.id",
			"cr_retailer_nid_info.nid_no",
			"cr_retailer_nid_info.retailer_code",
			"retailers.name",
			"distributorspoint.name AS dp_name",
			"company.name AS dh_name",
			"cr_retailer_nid_info.name_bn",
			"cr_retailer_nid_info.name_eng",
			"cr_retailer_nid_info.father_bn",
			"cr_retailer_nid_info.father_eng",
			"cr_retailer_nid_info.mother_bn",
			"cr_retailer_nid_info.mother_eng",
			knex.raw(`DATE_FORMAT(cr_retailer_nid_info.dob, "%d %b %Y") AS dob`),
			"cr_retailer_nid_info.mother_eng",
			"cr_retailer_nid_info.image_path",
			knex.raw(`DATE_FORMAT(cr_retailer_nid_info.created, "%d %b %Y") AS kyc_date`),
			"cr_retailer_nid_info.presentAddress_bn",
			"cr_retailer_nid_info.presentAddress_eng"
		)
		.innerJoin("retailers", "retailers.retailer_code", "cr_retailer_nid_info.retailer_code")
		.innerJoin("distributorspoint", "retailers.dpid", "distributorspoint.id")
		.innerJoin("company", "distributorspoint.dsid", "company.id")
		.where(function () {
			this.where("retailers.stts", 1);
			this.where("cr_retailer_nid_info.status", 1);
			this.where("cr_retailer_nid_info.info_check_log_id", id);
		});
	return query;
}

const dateFormat = async function (date) {
	const date_words = date.split('T');
	// const full_date = date_words[2] + '-' + date_words[0] + '-' + date_words[1];
	return date_words[0];
}

const camelize = async function (text) {
	text = text.replace(/[-_\s.]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
	return text.substr(0, 1).toLowerCase() + text.substr(1);
}

const addressInfoExtract = async function (text) {
	var address = text.split(',');
	var string_count = parseInt(address.length);

	var district_index = string_count - 1;
	var birth_district_index = string_count - 1;
	var thana_index = district_index - 1;
	var postal_code_index = thana_index - 1;

	var addressInfo = {
		'district': address[district_index].trim(),
		'birth_district': address[birth_district_index].trim(),
		'thana': address[thana_index].trim(),
		'postal_code': ((address[postal_code_index].trim()).replace(/^Post Office: /, '')).trim()
	}
	return addressInfo;
}

module.exports = eKyc;