QUnit.module( "API" );
QUnit.test('success test', function(assert) {
    assert.expect(1);
    
    var target = $('<div></div>');
    var promise = new asyncHttp.request({"url":'../pages/home.html', "target": target});

    // return the `then` and not the original promise.
    return promise.then(function(data) {        
        assert.equal(target.html(), data, 'The html data is equals');
    });
});