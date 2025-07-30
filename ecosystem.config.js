//ecosystem.config.js

module.exports = {
	apps: [
		{
			name: 'address-validation-service',
			script: 'dist/server.js',
			exec_mode: 'cluster',
			watch: false,
			env: {
				NODE_ENV: 'production',
			},
		},
	],
};
