# Class: Access

This class is for requesting and managing access to modules/folders on the
remote. It gets initialized as `remoteStorage.access`.

## Methods

### claim()

> **claim**(`scope`, `mode`): `void`

Claim access on a given scope with given mode.

#### Parameters

• **scope**: `string`

An access scope, such as `contacts` or `calendar`

• **mode**: `AccessMode`

Access mode. Either `r` for read-only or `rw` for read/write

#### Returns

`void`

#### Example

```javascript
remoteStorage.access.claim('contacts', 'r');
remoteStorage.access.claim('pictures', 'rw');
```

Claiming root access, meaning complete access to all files and folders of a storage, can be done using an asterisk for the scope:

```javascript
remoteStorage.access.claim('*', 'rw');
```

#### Defined in

[access.ts:68](https://github.com/remotestorage/remotestorage.js/blob/16fab691d67a1b3ad2e8a6ceaebe1544aa1cae54/src/access.ts#L68)
