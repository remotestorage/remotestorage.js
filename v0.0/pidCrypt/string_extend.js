/*----------------------------------------------------------------------------*/
 // Copyright (c) 2010 pidder <www.pidder.com>
 // Permission to use, copy, modify, and/or distribute this software for any
 // purpose with or without fee is hereby granted, provided that the above
 // copyright notice and this permission notice appear in all copies.
 //
 // THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 // WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 // MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 // ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 // WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 // ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 // OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
/*----------------------------------------------------------------------------*/
/*
*  Maps the pidcrypt utillity functions for string operations to the
*  javascript core class String
*
*
/*----------------------------------------------------------------------------*/
String.prototype.encodeBase64 = function(utf8encode)
{
  return pidCryptUtil.encodeBase64(this,utf8encode);
}
String.prototype.decodeBase64 = function(utf8decode)
{
  return pidCryptUtil.decodeBase64(this,utf8decode);
}
String.prototype.encodeUTF8 = function()
{
  return pidCryptUtil.encodeUTF8(this);
}
String.prototype.decodeUTF8  = function()
{
  return pidCryptUtil.decodeUTF8(this);
}
String.prototype.convertToHex = function()
{
  return pidCryptUtil.convertToHex(this);
}
String.prototype.convertFromHex = function()
{
  return pidCryptUtil.convertFromHex(this);
}
String.prototype.stripLineFeeds = function()
{
  return pidCryptUtil.stripLineFeeds(this);
}
String.prototype.toByteArray =  function()
{
  return pidCryptUtil.toByteArray(this);
}
String.prototype.fragment = function(length,lf)
{
  return pidCryptUtil.fragment(this,length,lf);
}
String.prototype.formatHex = function(length)
{
  return pidCryptUtil.formatHex(this,length);
}
