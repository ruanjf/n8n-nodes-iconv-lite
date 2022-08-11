import {
	BINARY_ENCODING,
	IExecuteFunctions
} from 'n8n-core';
import {
	IBinaryKeyData,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	INodePropertyOptions,
} from 'n8n-workflow';
import iconv from 'iconv-lite';
import {
	Options
} from 'iconv-lite';

iconv.encodingExists('utf8'); // load all codec

// Create options for bomAware and encoding
const bomAware: string[] = [];
const encodeDecodeOptions: INodePropertyOptions[] = [];
const encodings = (iconv as any).encodings; // tslint:disable-line:no-any
Object.keys(encodings).forEach(encoding => {
	if (!(encoding.startsWith('_') || typeof encodings[encoding] === 'string')) { // only encodings without direct alias or internals
		if (encodings[encoding].bomAware) {
			bomAware.push(encoding);
		}
		encodeDecodeOptions.push({ name: encoding, value: encoding });
	}
});

encodeDecodeOptions.sort((a, b) => {
	if (a.name < b.name) { return -1; }
	if (a.name > b.name) { return 1; }
	return 0;
});

export class IconvLite implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Iconv Lite',
		name: 'iconvLite',
		group: ['transform'],
		version: 1,
		description: 'Convert character encodings',
		defaults: {
			name: 'Iconv Lite',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			// Node properties which the user gets displayed and
			// can change on the node.
			{
				displayName: 'Binary Property Input',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				placeholder: '',
				description: 'Name of the binary property from which to read the binary data',
			},
			{
				displayName: 'Binary Property Output',
				name: 'binaryPropertyOutputName',
				type: 'string',
				default: 'data',
				required: false,
				placeholder: '',
				description: 'Name of the binary property from which to write the binary data',
			},
			{
				displayName: 'Input Encoding',
				name: 'inputEncoding',
				type: 'options',
				options: encodeDecodeOptions,
				default: '',
				required: true,
				placeholder: '',
				description: 'File encoding format',
			},
			{
				displayName: 'Output Encoding',
				name: 'outputEncoding',
				type: 'options',
				options: encodeDecodeOptions,
				default: 'utf8',
				required: true,
				placeholder: '',
				description: 'File encoding format',
			},
			{
				displayName: 'Strip BOM',
				name: 'stripBOM',
				type: 'boolean',
				default: false,
				required: false,
				placeholder: '',
				description: 'Strip BOM',
			},
			{
				displayName: 'Add BOM',
				name: 'addBOM',
				type: 'boolean',
				default: false,
				required: false,
				placeholder: '',
				description: 'Add BOM',
			},
		],
	};

	// The function below is responsible for actually doing whatever this node
	// is supposed to do. In this case, we're just appending the `myString` property
	// with whatever the user has entered.
	// You can make async calls and use `await`.
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		let item: INodeExecutionData;

		// Iterates over all input items and add the key "myString" with the
		// value the parameter "myString" resolves to.
		// (This could be a different value for each item in case it contains an expression)
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {

				item = items[itemIndex];

				const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;
				if (item.binary === undefined || item.binary[binaryPropertyName] === undefined) {
					// Property did not get found on item
					continue;
				}
				const binaryPropertyOutputName = this.getNodeParameter('binaryPropertyOutputName', itemIndex, binaryPropertyName) as string;
				const inputEncoding = this.getNodeParameter('inputEncoding', itemIndex) as string;
				const outputEncoding = this.getNodeParameter('outputEncoding', itemIndex) as string;
				const options: Options = {};
				const stripBOM = this.getNodeParameter('stripBOM', itemIndex) as boolean;
				if (stripBOM) {
					options.stripBOM =  true;
				}
				const addBOM = this.getNodeParameter('addBOM', itemIndex) as boolean;
				if (addBOM) {
					options.addBOM =  true;
				}

				const binaryData = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
				const str = iconv.decode(binaryData, inputEncoding);
				const value = iconv.encode(str, outputEncoding, options);

				const oldData = item.binary[binaryPropertyName];
				item.binary[binaryPropertyOutputName] = await this.helpers.prepareBinaryData(value, oldData.fileName, oldData.mimeType)
			} catch (error) {
				// This node should never fail but we want to showcase how
				// to handle errors.
				if (this.continueOnFail()) {
					items.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
				} else {
					// Adding `itemIndex` allows other workflows to handle this error
					if (error.context) {
						// If the error thrown already contains the context property,
						// only append the itemIndex
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return this.prepareOutputData(items);
	}
}
