// Plugin factory for the Starlight accessories: injects the browser script with the options.
// `ai` is off by default; when on, the browser script loads starlight-onetag/api on first use.
export function makeAccessory(name, opts, fromStarlight) {
	return {
		name,
		hooks: {
			'config:setup'({ config: starlightConfig, addIntegration }) {
				const extra = fromStarlight ? fromStarlight(starlightConfig) : {};
				addIntegration({
					name,
					hooks: {
						'astro:config:setup'({ injectScript, config }) {
							// Page scripts from every integration share one module: keep the names unique.
							const id = name.replace(/\W/g, '_');
							const base = (config.base || '/').replace(/\/?$/, '/');
							const cfg = JSON.stringify({ ...opts, ...extra, base });
							injectScript(
								'page',
								`import ${id}_init from ${JSON.stringify(name + '/client')};\n` +
									`const ${id}_cfg = ${cfg};\n` +
									`if (${id}_cfg.ai) ${id}_cfg.ai = Object.assign({ base: ${id}_cfg.base, via: ${JSON.stringify(name)} }, ${id}_cfg.ai === true ? {} : ${id}_cfg.ai, { key: (${id}_cfg.ai && ${id}_cfg.ai.key) || import.meta.env.PUBLIC_ONETAG_KEY || "" });\n` +
									`${id}_init(${id}_cfg);`
							);
						},
					},
				});
			},
		},
	};
}
