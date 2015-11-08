var
  chai = require( "chai" ),
  assert = chai.assert,
  expect = chai.expect,
  should = chai.should(),
  Throttler = require( "../index.js" ) ;


(function () {

  "use strict";

  describe( "Throttler", function () {

    it( "constructs an env specific throttler", function( done )
    {
      var throttler = new Throttler( function( ) {
        var envHost = process.env.OPSCENTER_HOST || "localhost";
        throttler._opsCenterHost.should.be.a( "string" );
        throttler._opsCenterHost.indexOf( envHost ).should.equal( 0 );
        done();
      } );
    } );

    it( "has nodes on init", function( done )
    {
      var throttler = new Throttler( function( ) {
        throttler.nodes().should.be.a( "object" );
        assert( Object.keys(throttler.nodes()).length > 0, "Unknown host or error" );
        done();
      } );
      throttler.nodes().should.be.a( "object" );
    } );

    it( "can thrrottle", function( done ) {
      var throttler = new Throttler( );
          throttler.throttle.should.be.a( "function" );
          throttler.stopListen.should.be.a( "function" );
          var tmr = setTimeout(
            function() {
              done( new Error( "Throttle takes too long. Is the cluster really busy at the moment?!" ) );
            },
            2000 );
          throttler.throttle( function() {
            clearTimeout( tmr );
            throttler.should.have.property( "_intervalId" );
            throttler.stopListen();
            throttler.should.not.have.property( "_intervalId" );
            done();
          });
    } );

  } );

})();