(function ($) {
    // Extend jQuery.fn with our new method
    


    $.mockjaxSettings['responseTime'] = 4000;
    $.mockjax({
        url: "/autoload",
        response: function (settings) {
            this.responseText = new Date().toString() + '<br/>';
        }
    });
    $.mockjax({
        url: "/autoload-stack",
        response: function (settings) {
            this.responseText = new Date().toString() + '<br/>From stack <br/><div async-autoload="/autoload"><span class="async-indicator">Loading</span></div>';
        }
    });

    $.fn.extend({
        animateCss: function (animationName) {
            var animationEnd = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';
            this.addClass('animated ' + animationName).one(animationEnd, function () {
                $(this).removeClass('animated ' + animationName);
            });
            return this;
        }
    });
})(jQuery);