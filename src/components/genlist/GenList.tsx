/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import "./GenList.scss";
import { type Tool, SchemaType } from "@google/generative-ai";
import { useEffect, useState, useCallback, memo } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import {
  ToolCall,
  ToolResponse,
  LiveFunctionResponse,
} from "../../multimodal-live-types";
import { List, ListProps } from "./List";
import { Chips } from "./Chips";

// Types
interface CreateListArgs {
  id: string;
  heading: string;
  list_array: string[];
}
interface EditListArgs extends CreateListArgs {}
interface RemoveListArgs {
  id: string;
}
interface ResponseObject extends LiveFunctionResponse {
  name: string;
  response: { result: object };
}

// Tools
const toolObject: Tool[] = [
  {
    functionDeclarations: [
      {
        "name": "get_document_fields",
        "description": "Returns current values of document fields.  Called immediately before calling `set_recited_fields`, to ensure latest version is being set.",
        "parameters": {
          "type": SchemaType.OBJECT,
          "properties": {
            "fields": {
              "type": SchemaType.ARRAY,
              "items": {
                "type": SchemaType.STRING,
                "enum": [
                  "issuer",
                  "pids",
                  "date",
                  "party_names",
                  "tax_paid_year",
                  "orders_passed",
                  "conversion_purpose",
                  "boundaries",
                  "CD_no"
                ]
              }
            }
          }
        }
      },
      {
        "name": "set_recited_fields",
        "description": "Records multiple field values that user has recited. User may recite one or many fields like 'issuer is BDA and pids are 123,456'",
        "parameters": {
          "type": SchemaType.OBJECT,
          "properties": {
            "recited_values": {
              "type": SchemaType.OBJECT,
              "properties": {
                "issuer": {
                  "type": SchemaType.STRING
                },
                "pids": {
                  "type": SchemaType.STRING
                },
                "date": {
                  "type": SchemaType.STRING
                },
                "party_names": {
                  "type": SchemaType.STRING
                },
                "tax_paid_year": {
                  "type": SchemaType.STRING
                },
                "orders_passed": {
                  "type": SchemaType.STRING
                },
                "conversion_purpose": {
                  "type": SchemaType.STRING
                },
                "boundaries": {
                  "type": SchemaType.STRING
                },
                "CD_no": {
                  "type": SchemaType.STRING
                }
              }
            }
          },
          "required": [
            "recited_values"
          ]
        }
      },
      // {
      //   name: "look_at_lists",
      //   description:
      //     "Returns all current lists. Called immediately before calling `edit_list`, to ensure latest version is being edited.",
      // },
      // {
      //   name: "edit_list",
      //   description:
      //     "Edits list with specified id. Requires `id`, `heading`, and `list_array`. You must provide the complete new list array. May be called multiple times, once for each list requiring edit.",
      //   parameters: {
      //     type: SchemaType.OBJECT,
      //     properties: {
      //       id: {
      //         type: SchemaType.STRING,
      //       },
      //       heading: {
      //         type: SchemaType.STRING,
      //       },
      //       list_array: {
      //         type: SchemaType.ARRAY,
      //         items: {
      //           type: SchemaType.STRING,
      //         },
      //       },
      //     },
      //     required: ["id", "heading", "list_array"],
      //   },
      // },
      // {
      //   name: "remove_list",
      //   description:
      //     "Removes the list with specified id. Requires `id`. May be called multiple times, once for each list you want to remove.",
      //   parameters: {
      //     type: SchemaType.OBJECT,
      //     properties: {
      //       id: {
      //         type: SchemaType.STRING,
      //       },
      //     },
      //     required: ["id"],
      //   },
      // },
      // {
      //   name: "create_list",
      //   description:
      //     "Creates new list. Requires `id`, `heading`, and `list_array`. May be called multiple times, once for each list you want to create.",
      //   parameters: {
      //     type: SchemaType.OBJECT,
      //     properties: {
      //       id: {
      //         type: SchemaType.STRING,
      //       },
      //       heading: {
      //         type: SchemaType.STRING,
      //       },
      //       list_array: {
      //         type: SchemaType.ARRAY,
      //         items: {
      //           type: SchemaType.STRING,
      //         },
      //       },
      //     },
      //     required: ["id", "heading", "list_array"],
      //   },
      // },
    ],
  },
];

const systemInstructionObject = {
  parts: [
    {
      text: `You are a smart dictation assistant for legal document data entry. Your role is to accurately capture and update document fields as users dictate them.
      # Document Template Fields: issuer, pids, date, party_names, tax_paid_year, orders_passed, conversion_purpose, boundaries, CD_no

      # Core Behaviors:
      1. Direct Dictation Mode:
      - Listen for field-value pairs in user's speech
      - Capture exact values as dictated
      - Example: "issuer is Bangalore Development Authority"
        → set_recited_fields({"issuer": "Bangalore Development Authority"})
          
      2. Smart Update Mode:
      - Activate when user indicates modifications to existing data
      - Triggers: "change", "correct", "update", "add to", "fix"
      - First fetch current value using get_document_fields
      - Then apply the specified changes
      - Example: "change BDA to Bangalore Development Authority in issuer"
        1. get_document_fields(["issuer"])
        2. set_recited_fields with updated value
          
      3. Multi-Field Capture:
      - Process multiple fields in single dictation
      - Example: "pids are Site 123 Block A and date is March 15 2024"
        → set_recited_fields({"pids": "Site 123 Block A", "date": "March 15 2024"})
          
      Process all inputs silently - no conversational responses needed. Focus on accurate data capture and smart field updates.`,
    },
  ],
};

// Chips
const INITIAL_SCREEN_CHIPS = [
  { label: "🇫🇷 Paris packing list", message: "Paris packing list" },
  {
    label: "🎬 Top 10 cult classics",
    message: "Top 10 cult classics",
  },
  {
    label: "📚 Sci-fi reading list",
    message: "Sci-fi reading list",
  },
  { label: "🍪 Cookie ingredients", message: "Cookie ingredients" },
];

const LIST_SCREEN_CHIPS = [
  {
    label: "😊 Add more emojis",
    message: "Add more emojis to list items",
  },
  {
    label: "✨ Organise into categories",
    message: "Organise it into categories",
  },
  {
    label: "💫 Break into separate lists",
    message: "Break it down into separate lists",
  },
  { label: "🪄 Clear and start again", message: "Clear and start again" },
];

function GenListComponent() {
  const { client, setConfig, connect, connected } = useLiveAPIContext();

  useEffect(() => {
    setConfig({
      model: "models/gemini-2.0-flash-exp",
      generationConfig: {
        responseModalities: "text", // switch to "audio" for audio out
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
        },
      },
      systemInstruction: systemInstructionObject,
      tools: toolObject,
    });
  }, [setConfig]);

  const [isAwaitingFirstResponse, setIsAwaitingFirstResponse] = useState(false);
  const [initialMessage, setInitialMessage] = useState("");
  const [listsState, setListsState] = useState<ListProps[]>([]);
  const [toolResponse, setToolResponse] = useState<ToolResponse | null>(null);
  const [data, setData] = useState<any>({
    issuer: "",
    pids: "",
    date: "",
    party_names: "",
    tax_paid_year: "",
    orders_passed: "",
    conversion_purpose: "",
    boundaries: "",
    CD_no: ""
  });

  const handleChange = (e:any, key:any) => {
    setData({
      ...data,
      [key]: e.target.value
    });
  };

  // Update existing list
  const updateList = useCallback((listId: string, updatedList: string[]) => {
    setListsState((prevLists) =>
      prevLists.map((list) => {
        if (list.id === listId) {
          return { ...list, list_array: updatedList };
        } else {
          return list;
        }
      })
    );
  }, []);

  // Scroll to new list after timeout
  const scrollToList = (id: string) => {
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 100);
  };

  // Handle checkbox change from List component
  const handleCheckboxChange = useCallback((listId: string, index: number) => {
    setListsState((prevLists) =>
      prevLists.map((list) => {
        if (list.id === listId) {
          const updatedList = [...list.list_array];
          const item = updatedList[index];
          if (item.startsWith("- [ ] ")) {
            updatedList[index] = item.replace("- [ ] ", "- [x] ");
          } else if (item.startsWith("- [x] ")) {
            updatedList[index] = item.replace("- [x] ", "- [ ] ");
          }
          return { ...list, list_array: updatedList };
        }
        return list;
      })
    );
  }, []);

  const updateData = useCallback((newData: any) => {
    console.log(newData)
    setData((prev: any) =>
      ({ ...prev, ...newData })
    );
  },[]);

  useEffect(() => {
    const onToolCall = (toolCall: ToolCall) => {
      const fCalls = toolCall.functionCalls;
      const functionResponses: ResponseObject[] = [];

      if (fCalls.length > 0) {
        fCalls.forEach((fCall) => {
          let functionResponse = {
            id: fCall.id,
            name: fCall.name,
            response: {
              result: { string_value: `${fCall.name} OK.` },
            },
          };
          switch (fCall.name) {
            case "get_document_fields": {
              break;
            }
            case "set_recited_fields": {
              const args = fCall.args as any;
              updateData(args.recited_values);
              break;
            }
            case "look_at_lists": {
              break;
            }
            case "edit_list": {
              const args = fCall.args as EditListArgs;
              updateList(args.id, args.list_array);
              break;
            }
            case "remove_list": {
              const args = fCall.args as RemoveListArgs;
              setListsState((prevLists) =>
                prevLists.filter((list) => list.id !== args.id)
              );
              break;
            }
            case "create_list": {
              const args = fCall.args as EditListArgs;
              const newList: ListProps = {
                id: args.id,
                heading: args.heading,
                list_array: args.list_array,
                onListUpdate: updateList,
                onCheckboxChange: handleCheckboxChange,
              };
              setListsState((prevLists) => {
                const updatedLists = [...prevLists, newList];
                return updatedLists;
              });
              scrollToList(newList.id);
              break;
            }
          }
          if (functionResponse) {
            functionResponses.push(functionResponse);
          }
        });

        // Send tool responses back to the model
        const toolResponse: ToolResponse = {
          functionResponses: functionResponses,
        };
        setToolResponse(toolResponse);
      }
    };
    setIsAwaitingFirstResponse(false);
    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client, handleCheckboxChange, updateList]);

  useEffect(() => {
    if (toolResponse) {
      const updatedToolResponse: ToolResponse = {
        ...toolResponse,
        functionResponses: toolResponse.functionResponses.map(
          (functionResponse) => {
            const responseObject = functionResponse as ResponseObject;
            if (responseObject.name === "look_at_lists") {
              return {
                ...functionResponse,
                response: {
                  result: {
                    object_value: listsState,
                  },
                },
              };
            } else {
              return functionResponse;
            }
          }
        ),
      };
      client.sendToolResponse(updatedToolResponse);
      setToolResponse(null);
    }
  }, [toolResponse, listsState, client, setToolResponse]);

  const connectAndSend = async (message: string) => {
    setIsAwaitingFirstResponse(true);
    if (!connected) {
      try {
        await connect();
      } catch (error) {
        throw new Error("Could not connect to Websocket");
      }
    }
    client.send({
      text: `${message}`,
    });
  };

  //   Rendered if list length === 0
  const renderInitialScreen = () => {
    return (
      <>
        {/* Hide while connecting to API */}
        {!isAwaitingFirstResponse && (
          <div className="initial-screen">
            <div className="spacer"></div>
            <h1>📝 Start a list about:</h1>
            <input
              type="text"
              value={initialMessage}
              className="initialMessageInput"
              placeholder="type or say something..."
              onChange={(e) => setInitialMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  connectAndSend(`Start a list about: ${initialMessage}`);
                }
              }}
            />
            <div className="spacer"></div>
            <Chips
              title={"How about:"}
              chips={INITIAL_SCREEN_CHIPS}
              onChipClick={(message) => {
                connectAndSend(`Start a list about: ${message}`);
              }}
            />
            <div className="spacer"></div>
          </div>
        )}
      </>
    );
  };

  //   Rendered if list length > 0
  const renderListScreen = () => {
    return (
      <>
        <div className="list-screen">
          {listsState.map((listData) => (
            <List
              key={listData.id}
              id={listData.id}
              heading={listData.heading}
              list_array={listData.list_array}
              onListUpdate={updateList}
              onCheckboxChange={handleCheckboxChange}
            />
          ))}
          <Chips
            title={"Try saying:"}
            chips={LIST_SCREEN_CHIPS}
            onChipClick={(message) => {
              client.send({ text: message });
            }}
          />
        </div>
      </>
    );
  };

  useEffect(() => {
    console.log(data)
  }, [data])

  return (
    <div className="app">
      {/* {listsState.length === 0 ? renderInitialScreen() : renderListScreen()} */}
      <table style={{
          width: '100%',
          // borderCollapse: 'collapse',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        }}>
        <thead>
          <tr>
            <th style={{
                backgroundColor: '#f4f4f9',
                padding: '12px',
                textAlign: 'left',
                fontWeight: '600',
                borderBottom: '2px solid #ddd',
                 color: "black",
                 width: "20%"
              }}>Key</th>
            <th style={{
                backgroundColor: '#f4f4f9',
                padding: '12px',
                textAlign: 'left',
                fontWeight: '600',
                borderBottom: '2px solid #ddd',
                color: "black"
              }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(data).map((key) => (
            <tr key={key}>
              <td style={{
                  padding: '12px',
                  borderBottom: '1px solid #ddd',
                  fontWeight: '500',
                  backgroundColor: '#fafafa',
                  color: "black",
                  textAlign: "left"
                }}>{key}</td>
              <td style={{
                  padding: '12px',
                  borderBottom: '1px solid #ddd',
                  backgroundColor: '#fafafa',
                  color: "black"
                }}>
                {data[key]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const GenList = memo(GenListComponent);
