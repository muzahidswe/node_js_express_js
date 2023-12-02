'use strict'

// ref: https://devhints.io/knex
// TODO: implement more dynamic env var settings loader
require('dotenv').config();

module.exports = {
  development: {
    client: process.env.DB_CONNECTION,
	connection: {
		host : process.env.DB_HOST,
		user : process.env.DB_USERNAME,
		password : process.env.DB_PASSWORD,
		database : process.env.DB_DATABASE,
		port: process.env.DB_PORT
	},
	pool: {
      min: 2,
      max: 150
    }
  },
  staging: {
    client: 'postgresql',
    connection: {
      database: 'my_db',
      user:     'username',
      password: 'password'
    },
    pool: {
      min: 2,
      max: 100
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  },
  production: {
    client: 'postgresql',
    connection: {
      database: 'my_db',
      user:     'username',
      password: 'password'
    },
    pool: {
      min: 2,
      max: 100
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  }
};
