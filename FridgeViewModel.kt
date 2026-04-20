package com.project.fridgemate.ui.fridge

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.project.fridgemate.data.remote.ApiClient
import com.project.fridgemate.data.remote.dto.InventoryItemDto
import com.project.fridgemate.data.repository.FridgeRepository
import com.project.fridgemate.data.repository.FridgeResult
import com.project.fridgemate.data.repository.InventoryItemRepository
import kotlinx.coroutines.launch

class FridgeViewModel(application: Application) : AndroidViewModel(application) {

    private val fridgeRepository = FridgeRepository(application.applicationContext)
    private val itemRepository = InventoryItemRepository(application.applicationContext)

    sealed class State {
        object Loading : State()
        data class Items(val items: List<FridgeItem>) : State()
        object Empty : State()
        object NoFridge : State()
        object NotLoggedIn : State()
        data class Error(val message: String) : State()
    }

    private val _state = MutableLiveData<State>(State.Loading)
    val state: LiveData<State> = _state

    fun loadItems() {
        if (!ApiClient.getTokenManager().isLoggedIn) {
            _state.value = State.NotLoggedIn
            return
        }
        viewModelScope.launch {
            val cached = itemRepository.getCachedItems()
            if (cached.isNotEmpty()) {
                _state.value = State.Items(buildFridgeItemList(cached))
            } else {
                // No cache yet — show spinner on first load
                _state.value = State.Loading
            }

            // Refresh from network in background
            when (val fridgeResult = fridgeRepository.getMyFridge()) {
                is FridgeResult.NoFridge -> {
                    itemRepository.clearCache()
                    _state.value = State.NoFridge
                }
                is FridgeResult.Error -> {
                    if (cached.isEmpty()) _state.value = State.Error(fridgeResult.message)
                }
                is FridgeResult.Success -> {
                    val items = itemRepository.getItems(fridgeResult.data.id)
                    _state.value = if (items.isEmpty()) State.Empty
                                   else State.Items(buildFridgeItemList(items))
                }
            }
        }
    }

    private fun buildFridgeItemList(items: List<InventoryItemDto>): List<FridgeItem> {
        val result = mutableListOf<FridgeItem>()
        val lowItems = items.filter { it.isRunningLow }
        if (lowItems.isNotEmpty()) {
            result.add(FridgeItem.RunningLow(lowItems.map { it.name }))
        }
        result.add(FridgeItem.CategoryHeader("Items"))
        items.forEach { result.add(FridgeItem.Product(it.name, it.quantity, it.isRunningLow)) }
        return result
    }
}
