# Interface: RSModule

Defined in: [remotestorage.ts:123](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L123)

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

### builder

> **builder**: (`privateClient`, `publicClient`) => `object`

Defined in: [remotestorage.ts:131](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L131)

A module builder function, which defines the actual module

#### Parameters

##### privateClient

[`BaseClient`](../../baseclient/classes/BaseClient.md)

##### publicClient

[`BaseClient`](../../baseclient/classes/BaseClient.md)

#### Returns

`object`

##### exports

> **exports**: `object`

###### Index Signature

\[`key`: `string`\]: `any`

***

### name

> **name**: `string`

Defined in: [remotestorage.ts:127](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L127)

The module's name, which is also the category (i.e. base folder) for document URLs on the remote storage
