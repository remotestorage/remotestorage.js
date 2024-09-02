import 'mocha';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import Solid from "../../src/solid";
import RemoteStorage from '../../src/remotestorage';

chai.use(chaiAsPromised);


describe('Solid backend', () => {
    let rs, solid;

    beforeEach(() => {
        rs = new RemoteStorage();
        solid = rs.solid;
    });

    afterEach(() => {
        rs.stopSync();
        rs.disconnect();
        Solid._rs_cleanup(rs);
    });

    describe("configuration", () => {
        it("configure sets userAddress when given", () => {
            solid.configure({
                userAddress: 'john.doe@gmail.com'
            });
            expect(solid.userAddress).to.equal('john.doe@gmail.com');
        });

        it("configure sets authURL when given", () => {
            solid.configure({
                href: 'https://solidcommunity.net'
            });
            expect(solid.authURL).to.equal('https://solidcommunity.net');
        });

        it("configure sets sessionProperties when given", () => {
            solid.configure({
                properties: {
                  sessionProperties: { check: true }
                }
            });
            expect(solid.sessionProperties).to.eql({ check: true });
        });

        it("configure sets podURL when given", () => {
            solid.configure({
                properties: {
                  podURL: 'https://example.solidcommunity.net/'
                }
            });
            expect(solid.selectedPodURL).to.equal('https://example.solidcommunity.net/');
        });
    });

    describe("connection setup", () => {
        it("setAuthURL will update auth URL", () => {
            solid.setAuthURL('https://solidcommunity.net');
            expect(solid.authURL).to.equal('https://solidcommunity.net');
        });

        it("setPodURL will update the selected pod URL", () => {
            solid.setPodURL('https://example.solidcommunity.net/');
            expect(solid.selectedPodURL).to.equal('https://example.solidcommunity.net/');
        });

        it("connect will emit error if the auth URL is not set", () => {
            const errorCheck = { hasError: false };
            rs.on('error', function(error) {
                expect(error.message).to.equal('No authURL is configured.');
                errorCheck.hasError = true;
            });
            solid.connect();
            expect(errorCheck.hasError).to.eql(true);
        });
    });
});