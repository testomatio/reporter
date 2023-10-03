Handlebars.registerHelper('calculateDuration', function(start, end) {
    const startTime = new Date('1970-01-01T' + start + 'Z');
    const endTime = new Date('1970-01-01T' + end + 'Z');

    const durationInMilliseconds = endTime - startTime;
    
    const hours = Math.floor(durationInMilliseconds / 3600000);
    const minutes = Math.floor((durationInMilliseconds % 3600000) / 60000);
    const seconds = Math.floor((durationInMilliseconds % 60000) / 1000);

    const durationString = `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;

    return durationString;
});
//TODO: join for each status
Handlebars.registerHelper('getTestsByStatus', function(tests, status) {
    return tests.filter(test => test.status.toLowerCase() === status.toLowerCase()).length;
});

Handlebars.registerHelper('eq', function (a, b, options) {
    return a === b ? options.fn(this) : options.inverse(this);
});