# Interface: RSModule

Represents a data module

## Example

```js
{
  name: 'examples',
  builder: function(privateClient, publicClient) {
    return {
      exports: {
        addItem(item): function() {
          // Generate a random ID/path
          const path = [...Array(10)].map(() => String.fromCharCode(Math.floor(Math.random() * 95) + 32)).join('');
          // Store the object, and ensure it conforms to the JSON Schema
          // type `example-item`
          privateClient.storeObject('example-item', path, item);
        }
      }
    }
  }
}
```

## Properties

### builder()

> **builder**: (`privateClient`, `publicClient`) => `object`

A module builder function, which defines the actual module

#### Parameters

• **privateClient**: [`BaseClient`](../../baseclient/classes/BaseClient.md)

• **publicClient**: [`BaseClient`](../../baseclient/classes/BaseClient.md)

#### Returns

`object`

##### exports

> **exports**: `object`

###### Index Signature

 \[`key`: `string`\]: `any`

#### Defined in

[remotestorage.ts:91](https://github.com/remotestorage/remotestorage.js/blob/6f00c54cc7f590233dcd3504f048d1df775bc754/src/remotestorage.ts#L91)

***

### name

> **name**: `string`

The module's name, which is also the category (i.e. base folder) for document URLs on the remote storage

#### Defined in

[remotestorage.ts:87](https://github.com/remotestorage/remotestorage.js/blob/6f00c54cc7f590233dcd3504f048d1df775bc754/src/remotestorage.ts#L87)
