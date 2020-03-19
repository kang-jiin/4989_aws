exports.dateFormat = function() {
    var d = new Date();
    var year = ('' + d.getFullYear()).substring(2,4);
    var month = d.getMonth() + 1;
    var day = d.getDate();
    if(month < 10) month = '0' + month;
    if(day < 10) day = '0' + day;
    return [year, month, day].join('');
}

exports.timeFormat = function() {
    var d = new Date();
    var hour = d.getHours();
    var minute = d.getMinutes();
    var second = d.getSeconds();
    if(hour < 10) hour = '0' + hour;
    if(minute < 10) minute = '0' + minute;
    if(second < 10) second = '0' + second;
    return [hour, minute, second].join('');
}
