describe('Making sure everything\'s alright and in place', function () {
    it('will check if localforage is in it\'s place', function () {
        expect(localforage).to.exist;
    });
    it('will check if localEntities is in it\'s place', function () {
        expect(localEntities).to.exist;
        expect(localEntities).to.be.an.instanceOf(LocalEntities)
    });
});
