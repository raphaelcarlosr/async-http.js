!function(o){o.mockjaxSettings.responseTime=5e3,o.mockjax({url:"/autoload",responseTime:1e3,response:function(o){this.responseText=(new Date).toString()+"<br/>"}}),o.mockjax({url:"/autoload-stack",response:function(o){this.responseText=(new Date).toString()+'<br/>From stack <br/><div async-autoload="/autoload"><span class="async-indicator">Loading</span></div>'}})}(jQuery);