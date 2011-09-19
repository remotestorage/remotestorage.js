function localToSync(str) {
  return str
    //dot-notation, set and get:
    .replace(new RegExp('localStorage\\\.(?!setItem)(?!getItem)(?!clear)(?!length)([A-Za-z0-9\.]+)([\ ]+)=([\ ]+)([A-Za-z0-9\.]+)','g'), 'syncStorage.setItem(\'$1\', $4)')
    .replace(new RegExp('localStorage\\\.(?!setItem)(?!getItem)(?!clear)(?!length)([A-Za-z0-9\.]+)','g'), 'syncStorage.getItem(\'$1\')')
    //bracket-notation, set and get:
    .replace(new RegExp('localStorage\\\[\\\'([A-Za-z0-9\.]+)\\\'\\\]([\ ]+)=([\ ]+)([A-Za-z0-9\.\(\)]+)','g'), 'syncStorage.setItem(\'$1\', $4)')
    .replace(new RegExp('localStorage\\\[\\\'([A-Za-z0-9\.]+)\\\'\\\]','g'), 'syncStorage.getItem(\'$1\')')
    //normal class methods:
    .replace('localStorage\.getItem', 'syncStorage.getItem')
    .replace('localStorage\.setItem', 'syncStorage.setItem')
    .replace('localStorage\.length', 'syncStorage.length')
    .replace('localStorage\.key', 'syncStorage.key')
    .replace('localStorage\.clear', 'syncStorage.clear')
}
