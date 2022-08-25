import {expect, getSigners} from '../helpers'
import {ApiPromise} from '@polkadot/api'
import ConstructorsPSP35 from '../../../typechain-generated/constructors/my_psp35'
import ContractPSP35 from '../../../typechain-generated/contracts/my_psp35'
import ConstructorsPSP35Receiver from '../../../typechain-generated/constructors/psp35_receiver'
import ContractPSP35Receiver from '../../../typechain-generated/contracts/psp35_receiver'
import {IdBuilder} from '../../../typechain-generated/types-arguments/my_psp35'

describe('MY_PSP35', () => {
  async function setup() {
    const api = await ApiPromise.create()

    const signers = getSigners()
    const defaultSigner = signers[2]
    const alice = signers[0]
    const bob = signers[1]

    const contractFactory = new ConstructorsPSP35(api, defaultSigner)
    const contractAddress = (await contractFactory.new()).address
    const contract = new ContractPSP35(contractAddress, defaultSigner, api)

    return {
      api,
      defaultSigner,
      alice,
      bob,
      contract,
      query: contract.query,
      tx: contract.tx
    }
  }

  async function setup_receiver() {
    const api = await ApiPromise.create()

    const signers = getSigners()
    const defaultSigner = signers[2]
    const alice = signers[0]
    const bob = signers[1]

    const contractFactory = new ConstructorsPSP35Receiver(api, defaultSigner)
    const contractAddress = (await contractFactory.new()).address
    const contract = new ContractPSP35Receiver(contractAddress, defaultSigner, api)

    return {
      api,
      defaultSigner,
      alice,
      bob,
      contract,
      query: contract.query,
      tx: contract.tx
    }
  }

  it('Balance of works', async () => {
    const { query, defaultSigner: sender, tx } = await setup()

    const token1 = IdBuilder.U8(0)
    const token2 = IdBuilder.U8(1)

    const amount1 = 1
    const amount2 = 20

    await expect(query.balanceOf(sender.address, null)).to.have.bnToNumber(0)
    await expect(tx.mintTokens(token1, amount1)).to.eventually.be.fulfilled
    await expect(tx.mintTokens(token2, amount2)).to.eventually.be.fulfilled

    await expect(query.balanceOf(sender.address, token1)).to.have.bnToNumber(amount1)
    await expect(query.balanceOf(sender.address, token2)).to.have.bnToNumber(amount2)
    await expect(query.balanceOf(sender.address, null)).to.have.bnToNumber(2)
  })

  it('Total supply works', async () => {
    const { query, tx } = await setup()

    const token1 = IdBuilder.U8(0)
    const token2 = IdBuilder.U8(1)

    const amount1 = 1
    const amount2 = 20

    await expect(query.totalSupply(null)).to.have.bnToNumber(0)
    await expect(tx.mintTokens(token1, amount1)).to.eventually.be.fulfilled
    
    await expect(query.totalSupply(token1)).to.have.bnToNumber(amount1)
    await expect(query.totalSupply(null)).to.have.bnToNumber(1)

    await expect(tx.mintTokens(token2, amount2)).to.eventually.be.fulfilled

    await expect(query.totalSupply(token2)).to.have.bnToNumber(amount2)
    await expect(query.totalSupply(null)).to.have.bnToNumber(2)
  })

  it('Allowance works', async () => {
    const { query, defaultSigner: sender, alice, tx } = await setup()

    const token = IdBuilder.U8(0)


    await expect(query.allowance(sender.address, alice.address, token)).to.have.bnToNumber(0)
    await expect(tx.approve(alice.address, token, 10)).to.eventually.be.fulfilled
    await expect(query.allowance(sender.address, alice.address, token)).to.have.bnToNumber(10)
  })

  it('PSP 35 - contract(not receiver) can accept the transfer', async () => {
    const { tx, query, defaultSigner: sender } = await setup()

    const { contract } = await setup()

    const token = IdBuilder.U8(0)


    // Arrange
    await expect(tx.mintTokens(token, 1)).to.eventually.be.fulfilled
    await expect(query.balanceOf(contract.address, token)).to.have.bnToNumber(0)
    await expect(query.balanceOf(sender.address, token)).to.have.bnToNumber(1)

    // Assert - Sender can send token to receiver
    await expect(tx.transferFrom(sender.address, contract.address, token, 1, 'data' as unknown as string[])).to.eventually.be.fulfilled
    await expect(query.balanceOf(contract.address, token)).to.have.bnToNumber(1)
    await expect(query.balanceOf(sender.address, token)).to.have.bnToNumber(0)
  })

  it('PSP 35 - receiver can accept the transfer', async () => {
    const { tx, query, defaultSigner: sender } = await setup()

    const { contract } = await setup_receiver()

    const token = IdBuilder.U8(0)

    // Arrange
    await expect(tx.mintTokens(token, 1)).to.eventually.be.fulfilled
    await expect(query.balanceOf(contract.address, token)).to.have.bnToNumber(0)
    await expect(query.balanceOf(sender.address, token)).to.have.bnToNumber(1)


    // Assert - Sender can send token to receiver
    await expect(tx.transferFrom(sender.address, contract.address, token, 1, 'data' as unknown as string[])).to.eventually.be.fulfilled
    await expect(query.balanceOf(contract.address, token)).to.have.bnToNumber(1)
    await expect(query.balanceOf(sender.address, token)).to.have.bnToNumber(0)
  })

  it('PSP 35 - receiver can reject the transfer', async () => {
    const { tx, query, defaultSigner: sender } = await setup()

    const { contract } = await setup_receiver()

    const token = IdBuilder.U8(0)

    // Arrange
    await expect(tx.mintTokens(token, 1)).to.eventually.be.fulfilled
    await expect(query.balanceOf(contract.address, token)).to.have.bnToNumber(0)
    await expect(query.balanceOf(sender.address, token)).to.have.bnToNumber(1)

    // Act - Receiver wants to reject the next transfer
    await expect(contract.tx.revertNextTransfer()).to.eventually.be.fulfilled

    // Assert - Sender cannot send token to receiver
    await expect(tx.transferFrom(sender.address, contract.address, token, 1, 'data' as unknown as string[])).to.eventually.be.rejected
    await expect(query.balanceOf(contract.address, token)).to.have.bnToNumber(0)
    await expect(query.balanceOf(sender.address, token)).to.have.bnToNumber(1)
  })

  it('Approve works', async () => {
    const { contract, query, defaultSigner: sender, alice } = await setup()

    const token = IdBuilder.U8(0)

    const tokenAmount = 20

    await expect(query.allowance(sender.address, alice.address, token))
      .to.have.bnToNumber(0)

    await expect(contract.tx.approve(alice.address, token, tokenAmount)).to.eventually.be.fulfilled
    await expect(query.allowance(sender.address, alice.address, token))
      .to.have.bnToNumber(tokenAmount)

    await expect(contract.tx.approve(alice.address, null, 1)).to.eventually.be.fulfilled
    await expect(query.allowance(sender.address, alice.address, token))
      .to.have.bnToString('340282366920938463463374607431768211455')
  })

  it('Transfer works', async () => {
    const { contract, query, defaultSigner: sender, alice, tx } = await setup()

    const token1 = IdBuilder.U8(0)
    const token2 = IdBuilder.U8(1)

    const token1Amount = 1
    const token2Amount = 10
    await expect(tx.mintTokens(token1, token1Amount)).to.eventually.be.fulfilled
    await expect(tx.mintTokens(token2, token2Amount)).to.eventually.be.fulfilled

    await expect(query.balanceOf(sender.address, null)).to.have.bnToNumber(2)
    await expect(query.balanceOf(sender.address, token1)).to.have.bnToNumber(token1Amount)
    await expect(query.balanceOf(sender.address, token2)).to.have.bnToNumber(token2Amount)
    await expect(query.totalSupply(null)).to.have.bnToNumber(2)

    await expect(contract.tx.transfer(alice.address, token2, token2Amount, [])).to.eventually.be.fulfilled

    await expect(query.balanceOf(sender.address, token1)).to.have.bnToNumber(token1Amount)
    await expect(query.balanceOf(sender.address, token2)).to.have.bnToNumber(0)
    await expect(query.balanceOf(alice.address, token1)).to.have.bnToNumber(0)
    await expect(query.balanceOf(alice.address, token2)).to.have.bnToNumber(token2Amount)
    await expect(query.balanceOf(sender.address, null)).to.have.bnToNumber(1)
    await expect(query.balanceOf(alice.address, null)).to.have.bnToNumber(1)

    await expect(contract.tx.transfer(alice.address, token1, token1Amount, [])).to.eventually.be.fulfilled
    await expect(contract.withSigner(alice).tx.transfer(sender.address, token2, token1Amount, [])).to.eventually.be.fulfilled

    await expect(query.balanceOf(sender.address, token1)).to.have.bnToNumber(0)
    await expect(query.balanceOf(sender.address, token2)).to.have.bnToNumber(token1Amount)
    await expect(query.balanceOf(alice.address, token1)).to.have.bnToNumber(token1Amount)
    await expect(query.balanceOf(alice.address, token2)).to.have.bnToNumber(token2Amount - token1Amount)
    await expect(query.balanceOf(sender.address, null)).to.have.bnToNumber(1)
    await expect(query.balanceOf(alice.address, null)).to.have.bnToNumber(2)
  })

  it('Transfer from works', async () => {
    const { contract, query, defaultSigner: sender, alice, tx } = await setup()

    const token1 = IdBuilder.U8(0)
    const token2 = IdBuilder.U8(1)

    const token1Amount = 1
    const token2Amount = 10

    await expect(tx.mintTokens(token1, token1Amount)).to.eventually.be.fulfilled
    await expect(tx.mintTokens(token2, token2Amount)).to.eventually.be.fulfilled

    await expect(contract.withSigner(alice).tx.approve(sender.address, null, 1)).to.eventually.be.fulfilled
    await expect(contract.tx.transferFrom(sender.address, alice.address, token2, token2Amount, [])).to.eventually.be.fulfilled

    await expect(query.balanceOf(sender.address, token1)).to.have.bnToNumber(token1Amount)
    await expect(query.balanceOf(sender.address, token2)).to.have.bnToNumber(0)
    await expect(query.balanceOf(alice.address, token1)).to.have.bnToNumber(0)
    await expect(query.balanceOf(alice.address, token2)).to.have.bnToNumber(token2Amount)

    await expect(contract.tx.transferFrom(sender.address, alice.address, token1, token1Amount, [])).to.eventually.be.fulfilled
    await expect(contract.tx.transferFrom(alice.address, sender.address, token2, token1Amount, [])).to.eventually.be.fulfilled

    await expect(query.balanceOf(sender.address, token1)).to.have.bnToNumber(0)
    await expect(query.balanceOf(sender.address, token2)).to.have.bnToNumber(token1Amount)
    await expect(query.balanceOf(alice.address, token1)).to.have.bnToNumber(token1Amount)
    await expect(query.balanceOf(alice.address, token2)).to.have.bnToNumber(token2Amount - token1Amount)
  })

  it('Transfer from insufficient balance should fail', async () => {
    const { contract, defaultSigner: sender, query, alice, tx } = await setup()

    const token = IdBuilder.U8(0)

    const tokenAmount = 1
    await expect(tx.mintTokens(token, tokenAmount)).to.eventually.be.fulfilled

    await expect(query.balanceOf(sender.address, token)).to.have.bnToNumber(tokenAmount)
    await contract.withSigner(alice).tx.approve(sender.address, token, tokenAmount)

    await expect(contract.tx.transferFrom(sender.address, alice.address, token, tokenAmount + 1, []))
      .to.eventually.be.rejected

    await expect(query.balanceOf(sender.address, token)).to.have.bnToNumber(tokenAmount)
  })

  it('Transfer from without allowance should fail', async () => {
    const { contract, defaultSigner: sender, alice, query, tx } = await setup()

    const token = IdBuilder.U8(0)

    const tokenAmount = 1
    await expect(tx.mintTokens(token, tokenAmount)).to.eventually.be.fulfilled

    await expect(query.balanceOf(sender.address, token)).to.have.bnToNumber(tokenAmount)

    await expect(contract.withSigner(alice).tx.transferFrom(sender.address, alice.address, token, tokenAmount, []))
      .to.eventually.be.rejected

    await expect(query.balanceOf(sender.address, token)).to.have.bnToNumber(tokenAmount)
  })
})
