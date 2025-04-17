//ecosystem.config.js

module.exports = {
	apps: [
		{
			name: 'candycomp-location-correction',
			script: 'dist/server.js',
			exec_mode: 'cluster',
			watch: false,
			env: {
				NODE_ENV: 'production',
			},
		},
	],
};
