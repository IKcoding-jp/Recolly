# infra/cloudfront_functions.tf

# wwwリダイレクト用CloudFront Function
resource "aws_cloudfront_function" "www_redirect" {
  name    = "${var.project_name}-www-redirect"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = <<-EOF
    function handler(event) {
      var request = event.request;
      var host = request.headers.host.value;
      if (host.startsWith('www.')) {
        var newUrl = 'https://${var.domain_name}' + request.uri;
        if (request.querystring && Object.keys(request.querystring).length > 0) {
          var qs = Object.keys(request.querystring).map(function(k) {
            var v = request.querystring[k];
            return v.multiValue
              ? v.multiValue.map(function(mv) { return k + '=' + mv.value; }).join('&')
              : k + '=' + v.value;
          }).join('&');
          newUrl += '?' + qs;
        }
        return {
          statusCode: 301,
          statusDescription: 'Moved Permanently',
          headers: { location: { value: newUrl } }
        };
      }
      return request;
    }
  EOF
}
