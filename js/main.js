// The ABI (Application Binary Interface) is the interface of the smart contract
import { abiBillboard } from './abi-billboard.js'

// Settings will be differ
import { webProvider, billboardAddress } from './settings.js'

const web3 = new Web3(window.ethereum);
const contractBillboardReadOnly = new web3.eth.Contract(abiBillboard, billboardAddress);

// const web3ReadOnly = new Web3(webProvider);
// const contractBillboardReadOnly = new web3ReadOnly.eth.Contract(abiBillboard, billboardAddress);

var connectedWallet;
let connected = false;

window.mySlots = [];

// ********************* SLOT DEFINITIONS ********************* //

const availableSlots = [
  { tier: 1, slots: 10, rows: 4, cols: 4, name: 'diamond', disabled: false },
  { tier: 2, slots: 4, rows: 3, cols: 10, name: 'moon', disabled: false },
  { tier: 3, slots: 40, rows: 2, cols: 2, name: 'gold', disabled: false },
  { tier: 4, slots: 8, rows: 2, cols: 5, name: 'platinum', disabled: true },
  { tier: 5, slots: 60, rows: 1, cols: 2, name: 'silver', disabled: true },
  { tier: 6, slots: 320, rows: 1, cols: 1, name: 'bronze', disabled: true }
]

const totalSlots = availableSlots.reduce((a, b) => a + (b['slots'] || 0), 0);

function formatSlotName(slot) {
  return (parseInt(slot) + 1).toString().padStart(3, '0')
}

function getTierInfo(tier) {
  var selectedTier = availableSlots.filter((t) => t.tier == parseInt(tier))[0]
  return selectedTier
}

// ********************* PAGE SETUP ********************* //

export const loadPage = async () => {
  setupPage();
}

topbar.config({
  autoRun      : true,
  barThickness : 3,
  barColors    : {
      '0'      : 'rgba(117, 160, 225, .9)',
      '.50'    : 'rgba(122, 32,  122, 1)',
      '1.0'    : 'rgba(117, 160, 225, .9)'
  },
  shadowBlur   : 10,
  shadowColor  : 'rgba(0,   0,   0,   .6)'
});
topbar.show();

async function setupPage() {

  // Wallet button
  $("#btn-connect").on('click', function () {
    if (!window.ethereum) { alert("Web3 wallet not found");
    } else { 
      if($(this).hasClass('connected')){
        $('body').toggleClass('panel-hidden');
      } else {
        connectWallet(); 
      }
      
    }
  });


  // Set metadata button
  $("#form-sign").validate({
    submitHandler: function(form) {
      let slotForm = $("form").serializeArray();
      let slotData = {};
      $.each(slotForm, function(i, field) {
        let fieldName = field.name.replace(/val-/g,'');
        slotData[fieldName] = field.value;
      });
      slotData['forSale'] = (slotData['forSale'] === 'true') ? true : false;
      // Remove slot from localStorage
      localStorage.removeItem(slotData.slot)

      contractBillboardReadOnly.methods._tokenData(0, slotData.slot).call().then(function (result, error) {
        // Now we can check the owner of the tokenID
        contractBillboardReadOnly.methods.ownerOf(result["tokenId"]).call().then(function (result, error) {
          // If the result (= owner wallet address) is the current wallet, we can proceed

          if (connectedWallet.toLowerCase() == result.toLowerCase()) {
            // Smart contract call to update data
            $('#form-slot').hide(); $('#processing').addClass('active');

            contractBillboard.methods.setMetaData(0, slotData.slot, slotData.img, slotData.url, slotData.forSale, slotData.owner)
            .send({ from: connectedWallet, })
            .then(function (result, error) { 
              loadSlotData(slotData.slot).then((updatedCell) => renderCell(updatedCell));
              $('#form-slot').show();
              $('#processing').removeClass('active');
              $('#overlay').removeClass('active');
            }).catch(function (error) { 
              console.log(error);
              window.location.reload(false);
              alert("Something went wrong with the transaction");
            });

          } else {
            alert("Only the NFT owner can update metadata");
          }
        });
      });
    }
  });

  // Set metadata button
  $("#form-buy").validate({
    submitHandler: function(form) {
      let slotForm = $("form").serializeArray();
      let slotData = {};
      $.each(slotForm, function(i, field) {
        let fieldName = field.name.replace(/val-/g,'');
        slotData[fieldName] = field.value;
      });
      slotData['forSale'] = (slotData['forSale'] === 'true') ? true : false;
      // Remove slot from localStorage
      localStorage.removeItem(slotData.slot);
      mintSlotWithData(slotData["buy-slot"], slotData["img"], slotData["url"], slotData["forSale"], slotData["owner"]);
    }
  });



  // Update owner
  $("#a_setOwner").click(function () {
    var address = document.getElementById("a_owner").value;

    // Smart contract call
    contractBillboard.methods.updateContractOwner(address).send({ from: connectedWallet, }).then(function (result, error) {
      console.log("Update result:");
      console.log(result);
    }).catch(function (error) {
      console.log("Update error:");
      console.log(error);
    });
  });

  // Update minter
  $("#a_setMinter").click(function () {
    var address = document.getElementById("a_minter").value;

    // Smart contract call
    contractBillboard.methods.updateContractMinter(address).send({ from: connectedWallet, }).then(function (result, error) {
      console.log("Update result:");
      console.log(result);
    }).catch(function (error) {
      console.log("Update error:");
      console.log(error);
    });
  });

  // Auto-connect wallet and load grid if web3 (wallet owners)
  if (window.ethereum) { 
    connectWallet(); 
  } else {  
    // Load initial grid 
    loadGrid();
  }
}

//
// ********************* SETUP WALLET *********************
//

async function connectWallet() {
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }).then(function(result, error){
      connectedWallet = result[0]; 
      console.log(connectedWallet)
      loadGrid();
    })
    let connectedWalletStr = connectedWallet.substring(0, 6) + "..." + connectedWallet.substr(connectedWallet.length - 7);

    $("#btn-connect").html(connectedWalletStr).attr('title', connectedWallet);
    $('#btn-connect').tipso({ useTitle: true, background: '#4e178a' });

    $('#btn-logout').off().on('click', function() {
      disconnectWallet();
    });

    // Network to which MetaMask is connected
    let connectedNetwork = window.ethereum.networkVersion; 
    let networkName = "";
    switch(connectedNetwork) {
      case "1": networkName = "Ethereum Mainnet"; break;
      case "5": networkName = "Ethereum Mainnet"; break;
      default: networkName = "Unknown"; break;
    }

    $("#btn-connect, content, body").addClass("connected");
    connected = true;
    
  } catch (error) {
    if (error.code === 4001) {
    }
    loadGrid();
    console.error(error);
  }
}

function disconnectWallet() {
  connectedWallet = undefined;
  connected = false;
  $("#btn-connect, content, body").removeClass("connected");
  $("#btn-connect").html("Connect").removeAttr('title');
  $('#btn-connect').off().on('click', function() {
    connectWallet();
  });
}

//
// ********************* GRID *********************
//

let loadGrid = function() {
  var gridHtml = ""
  var slotNumber = 0
  availableSlots.forEach(function(slotTier) {
    for (var i = 0; i < slotTier['slots']; i++) {
      gridHtml += "<div id='sq-" + (slotNumber) + "' class='btn-slot " + slotTier['name'] + "' style='width:" + (slotTier['cols'] * 24) + "px;height:" + (slotTier['rows'] * 24) + "px;''></div>";
      slotNumber++;
    }
  });

  $("content").html(gridHtml);

  // Load info for each cell
  for (var i = 0; i < totalSlots; i++) {
    // Fetch from localStorage
    if(localStorage.getItem(i.toString()) == null) {
      var currentCell = loadSlotData(i).then(function(result, error){
        renderCell(result);
      })
    } else {
      var currentCell = JSON.parse(localStorage.getItem(i.toString())); 
      if(currentCell.mySlot) { window.mySlots.push(currentCell); }
      renderCell(currentCell);
    }
  }

  $('.slot-item').on('click', function(e) {
    e.preventDefault();

    if($(this).hasClass('mintable')) {

      if(connectedWallet) {
        var slot = $(this).attr('data-slot');
        var price = $(this).attr('data-price')

        localStorage.removeItem(slot);
        loadSlotData(slot).then(function(result) {
          Object.values(result);
          $('#buy-slot-id').text(slot);
          $('#buy-slot-price').text(price);
          $('#buy-slot').val(slot);
          $('#buy-overlay').addClass('active');
          $('#btn-buy').val('Buy slot - '+price+' ETH')
        });
      } else {
        alert("Please connect your wallet first!")
      }
    }
  });
}



function renderCell(currentCell) {

  if (currentCell['disabled']) {
    var slotHtml = "<a href='#disabled' target='_blank' class='empty slot-item disabled' title='<span notForSale></span><strong>Slot " + currentCell['slotName'] + "</strong> - Available Soon' data-i='" + currentCell['slot'] + "' data-slot='" + currentCell['slot'] + "'></a>";
  } else if (currentCell['adImage'] == "") {
    var slotHtml = "<a href='#mint' target='_blank' class='empty slot-item mintable' title='<span available></span><strong>Slot " + currentCell['slotName'] + "</strong> - Available (" + currentCell['slotTierPrice'] + " ETH)' data-i='" + currentCell['slot'] + "' data-price='" + currentCell['slotTierPrice'] + "' data-slot='" + currentCell['slot'] + "'></a>";
  } else if (currentCell['forSale']) {
    var slotHtml = "<a href='https://testnets.opensea.io/assets/" + billboardAddress + "/" + currentCell['tokenId'] + "' class='slot-item' data-slot='" + currentCell['slot'] + "' title='<span forSale></span><strong>Slot " + currentCell['slotName'] + "</strong> - For Sale - Owned by " + currentCell['slotOwner'] + "' data-i='"+ currentCell['slot'] +"' target='_blank'><img src='" + currentCell['adImage'] + "' class='slot-img'/></a>";
  } else {
    var slotHtml = "<a href='" + currentCell['redirectUrl'] + "' class='slot-item' data-slot='" + currentCell['slot'] + "' title='<span notForSale></span><strong>Slot " + currentCell['slotName'] + "</strong> - Not For Sale - Owned by " + currentCell['slotOwner'] + "' data-i='"+ currentCell['slot'] +"' target='_blank'><img src='" + currentCell['adImage'] + "' class='slot-img'/></a>";
  }
  $("#sq-" + currentCell['slot']).html(slotHtml);
  $('.slot-item').tipso({ useTitle: true, background: '#4e178a', width : 'auto' });
}

function loadSlotData(slot) {
  // Read contract data
  return contractBillboardReadOnly.methods._tokenData(0, slot.toString()).call().then(function (result, error) {
    return contractBillboard.methods.tierForSlot(slot.toString()).call().then(function (tier, error) {
      return contractBillboard.methods._tierPrice(tier).call().then(function (price, error) {
        
        // Data from tokendata response
        var adImage = result["adImage"];
        var redirectUrl = result["redirectUrl"];
        var slotName = formatSlotName(slot);
        var slotOwner = result["ownerName"] || 'nobody';
        var slotForSale = result["forSale"];
        var tokenId = result["tokenId"];

        // Create cell object with tier pricing
        var cellObject = { 
          adImage: adImage, 
          redirectUrl: redirectUrl, 
          slot: parseInt(slot), 
          slotName: slotName, 
          slotOwner: slotOwner, 
          slotForSale: slotForSale || false, 
          slotTier: tier,
          slotTierPrice: (parseInt(price) * 0.000000000000000001).toFixed(2),
          slotWidth: getTierInfo(tier)?.cols * 24,
          slotHeight: getTierInfo(tier)?.rows * 24,
          tokenId: tokenId,
          mySlot: false,
          disabled: getTierInfo(tier)?.disabled
        }

        // If it's my slot, push to array
        if(connectedWallet) {
          contractBillboardReadOnly.methods._tokenData(0, slot.toString()).call().then(function (result, error) {
            contractBillboardReadOnly.methods.ownerOf(tokenId).call().then(function (result, error) {
              if(connectedWallet.toLowerCase() == result.toLowerCase()) {
                cellObject.mySlot = true;
                window.mySlots.push(cellObject);
              }
              localStorage.setItem(slot.toString(), JSON.stringify(cellObject));
            });
          });
        } else {
          localStorage.setItem(slot.toString(), JSON.stringify(cellObject));
        }
        
        return cellObject;

      });
    });
  });

}

function mintSlot(slot) {
  contractBillboard.methods.tierForSlot(slot).call().then(function (tier, error) {
    contractBillboard.methods._tierPrice(tier).call().then(function (price, error) {
      contractBillboard.methods.mintSlot(0, slot).send({ from: connectedWallet, value: price }).then(function (result, error) {
        console.log("Mint result:");
        console.log(result);
        loadSlotData(slot).then((updatedCell) => renderCell(updatedCell));
      }).catch(function (error) {
        console.log("Mint error:");
        console.log(error);
        alert("Something went wrong with the transaction");
        window.location.reload(false);
      });
    });
  });

}

function mintSlotWithData(slot, adImage, redirectUrl, forSale, ownerName) {
  contractBillboard.methods.tierForSlot(slot).call().then(function (tier, error) {
    contractBillboard.methods._tierPrice(tier).call().then(function (price, error) {
      contractBillboard.methods.mintSlotWithData(
        0, 
        slot, 
        adImage,
        redirectUrl,
        forSale,
        ownerName
      ).send({ from: connectedWallet, value: price }).then(function (result, error) {
        console.log("Mint result:");
        console.log(result);
        loadSlotData(slot).then((updatedCell) => renderCell(updatedCell));
      }).catch(function (error) {
        console.log("Mint error:");
        console.log(error);
        alert("Something went wrong with the transaction");
        window.location.reload(false);
      });
    });
  });
}

var createSlotBox = function(slot) {
  $("#select-slot").html("");
  window.mySlots.forEach((entry) => {
    var slotName = entry['slotName'];
    var o = new Option(slotName, entry['slot']);
    $(o).html(slotName);
    $("#select-slot").append(o);
  });
  $("#select-slot").val(slot);
  /// jquerify the DOM object 'o' so we can use the html method
  $('#box #current-slot').text(formatSlotName(slot));
  $('#box #val-slot').val(slot);
  $('#overlay').addClass('active');
  $('.box-form').removeClass('active');

  loadSlotData(slot).then(function(result) {
    console.log(result)
    Object.values(result);
    $('#val-img').val(result.adImage);
    $('#val-forsale').val(result.slotForSale);
    $('#val-url').val(result.redirectUrl);
    $('#val-owner').val(result.slotOwner);
    $('#form-slot').addClass('active');
  });
}

$("#select-slot").on('change', function() {
  createSlotBox(this.value);
});

$("#btn-slots").click(function(){
  if(window.mySlots.length){
    let firstSlot = window.mySlots[0];
    createSlotBox(firstSlot['slot']);
  } else {
    alert('You got no slots');
  }
})


$(document).ready(function(){
  //topbar.hide();
  $('#btn-learnmore').click(function(){
    $('#about').addClass('active');
  });

  $('body').on('click', '.btn-slot', function (e){
      if(connected){
        let slot_name = $(this).find('.slot-item').data('slot');
        let slot_i = $(this).find('.slot-item').data('i')+"";
        if(window.mySlots.includes(parseInt(slot_i))){
          e.preventDefault();
          createSlotBox(slot_i);
        } 
      }
  });

  $('#bg-overlay, #btn-close').click(function(){
    $('#overlay').removeClass('active');
    $('#about').removeClass('active');
    $('#buy-overlay').removeClass('active');
  })

  $('.reset').on('click', function(e) {
    e.preventDefault();
    window.localStorage.clear();
    window.location.reload(false);
  });
})

