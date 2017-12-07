function extractImportDeclaration(node) {
	console.assert(node.type === 'ImportDeclaration', 'Node must be of type "ImportDeclaration"');

	const source = node.source.value;

	const specifiers = node.specifiers.map(specifier => specifier.imported ? ({
		imported: specifier.imported.name,
		local: specifier.local.name,
	}) : specifier.local.name);

	return [source, specifiers];
}

function depVarToParam(depVars, t) {

	if (depVars.length === 0) {
		return t.objectExpression([]);
	}

	if (depVars.length === 1 && (typeof depVars[0] === 'string')) {
		return t.identifier(depVars[0]);
	}

	return t.objectExpression(
		depVars.map(depVar => {
			return t.objectProperty(t.identifier(depVar.imported), t.identifier(depVar.local), false, true);
		})
	);
}


module.exports = function ({ types: t }) {
	return {

		pre() {
			this.dependencies = new Set();
		},

		visitor: {

			// Wrap file in AMD
			Program(path, file) {
				this.amdDepArr = t.arrayExpression([]);

				this.amdFn = t.functionExpression(
					null,
					[],
					t.blockStatement(
						path.get('body').map(path => path.node)
					)
				);

				path.get('body').map(path => path.remove());

				const { filename } = file.file.opts;

				path.pushContainer(
					'body',
					t.callExpression(
						t.identifier('define'),
						[
							...(() => filename ? [t.stringLiteral(filename)] : [])(),
							this.amdDepArr,
							this.amdFn,
						]
					)
				);
			},

			// Remove import statements
			ImportDeclaration(path, file) {
				this.dependencies.add(path.node);
				path.remove();
			},

			// Replace `export default` with `return`
			ExportDefaultDeclaration(path, file) {
				const declaration = path.get('declaration');

				path.replaceWith(
					t.returnStatement(
						declaration.node
					)
				);
			}
		},

		post() {
			this.dependencies.forEach(dep => {
				let [depSrc, depVars] = extractImportDeclaration(dep);

				this.amdDepArr.elements.push(t.stringLiteral(depSrc));

				this.amdFn.params.push(depVarToParam(depVars, t));
			});
		},
	};
};