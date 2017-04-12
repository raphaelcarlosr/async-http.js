$.mockjaxSettings['responseTime'] = 100;
$.mockjax({
    url: "/autoload",
    responseTime: 1000 * 1,
    response: function (settings) {
        this.responseText = (new Date).toString() + '<br/>';
    }
});
$.mockjax({
    url: "/autoload-stack",
    response: function (settings) {
        this.responseText = (new Date).toString() + '<br/>From stack <br/><div async-autoload="/autoload"><span class="async-indicator">Loading</span></div>';
    }
});