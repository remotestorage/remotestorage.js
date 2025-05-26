# Sharing data with others

The RS protocol is first and foremost a solution for _personal_ data storage,
as opposed to _collaborative_ data storage. This means that usually only the
owner of a storage account will be able to write data to it.

However, it is possible to share data with other people by storing it in the
special `public/` directory.

## How it works

Any documents whose path starts with `public/` can be accessed by anyone with
knowledge of the URL and without an access token. However, this is not the case
for directory listings, which are only available for authorized requests.

When your app [claims access](../getting-started/initialize-and-configure.html#claiming-access)
to a category, let's say `bookmarks`, the access token received when the user
authorizes the app to access their storage is automatically valid for both
paths starting with `bookmarks/` as well as `public/bookmarks/`.

## In your app

When using [data modules](../data-modules/) for reading and writing data, which
is the recommended way, your module is automatically initialized with both a
private and a public client instance.

Simply use `publicClient.storeObject()` or `publicClient.storeFile()` to store
data in the public category.

However, if you use an ad-hoc client via the
[scope](../getting-started/read-and-write-data.html#quick-and-dirty-creating-a-client-via-scope)
method, then you need to initialize it with the correct public path/scope.

In order to get the full public URL of a document, e.g. to offer it to the user
to share with others, you can use the
[getItemURL()](../api/baseclient/classes/BaseClient.html#getitemurl) function.

## Additional considerations

Public documents can only be accessed by people or machines who know the URL.
Thus, it is generally possible to share documents or files only with select
people by using a long, unique, and unguessable path.

Nevertheless, for use cases that require maximum privacy and security, the
document should be encrypted on the client side. Apps which do this usually use
a URL hash parameter for adding the encryption secret to the shared URL and
then extract it from there when opened with such a URL.

On the other hand, if unrestricted public access is desired, you can
standardize a document path/URL so that anyone can find it when given even
just a user address.

Furthermore, if you want to enable sharing a collection of documents all at
once, then your public URL may even point to a document that functions as an
index for other public documents.

::: tip
The building blocks for sharing data with RS may be very simple, but with a bit
of creativity, there are a surprising number of solutions you can implement on
top of these.
:::
