Data types
==========

.. ATTENTION::
   This is 5 years old and needs a better explanation of JSON-LD. Also, we need
   to introduce ``@type`` alongside the existing ``@context`` property, which
   we're currently (mis)using for specific data types. And we should also think
   about not scoping types in module names.

A great thing about having data on the web, is to be able to link to it and
rearrange it to fit the current circumstances. To facilitate that, eventually
you need to know how the data at hand is structured.  For documents on the web,
this is usually done via a MIME type. The MIME type of JSON objects however, is
always application/json.  To add that extra layer of "knowing what this object
is", remoteStorage aims to use `JSON-LD <http://json-ld.org/>`_.

A first step in that direction is to add a ``@context`` attribute to all JSON
data put into remoteStorage. This is what the *type* is for.

Within remoteStorage.js, ``@context`` values are built using three components:

``http://remotestorage.io/spec/modules/``
   A prefix to guarantee uniqueness

The module name
   Module names should be unique as well

The type name (given as argument to ``declareType()``)
   Naming the particular kind of object within its module

In retrospect, this means that whenever you introduce a new *type* in calls to
``storeObject()``, you should make sure that once your code is in the wild,
future versions of the code are compatible with the same JSON structure.
